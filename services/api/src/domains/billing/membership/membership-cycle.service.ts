import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../platform/common/app-logger';
import { runInJobContext } from '../../platform/common/job-context';
import { Cron } from '@nestjs/schedule';
import { PointsService } from '../points/points.service';
import { PointGrantType, PointLedgerEventType, PointsSource, Prisma } from '../../platform/prisma/generated';
import { MembershipRepository } from './membership.repository';
import {
  addMonths,
  carryoverCycleSourceId,
  getCarryoverPolicy,
  minDate,
  monthlyCycleIndexesDue,
  selectCarryoverGrants,
  subscriptionCycleSourceId,
  subtractMonths,
  type CarryoverPolicy,
} from './membership-cycle.helpers';

type MonthlySubscriptionCycleInput = {
  userId: string;
  membershipId: string;
  planId: string | null;
  features: Prisma.JsonValue | null;
  level: number;
  levelName: string;
  amount: number;
  cycleIndex: number;
  sourceId: string;
  cycleStart: Date;
  cycleEnd: Date;
};

type MonthlySubscriptionCycleResult = {
  created: boolean;
  grantId: string | null;
  carryoverCreated?: boolean;
  carryoverAmount?: number;
};

@Injectable()
export class MembershipCycleService {
  private readonly logger = new AppLogger(MembershipCycleService.name);

  constructor(
    private readonly repository: MembershipRepository,
    private readonly pointsService: PointsService,
  ) {}

  @Cron('0 2 * * *')
  async runDailyCycle() {
    return runInJobContext({ name: 'billing.membershipCycle', logger: this.logger }, async () => {
      try {
        const now = new Date();
        const pendingChanges = await this.applyPendingMembershipChanges(now);
        const monthlyGrants = await this.grantDueSubscriptionPoints(now);
        const expiredGrants = await this.pointsService.expireGrants(now);
        const expiredMemberships = await this.expireMemberships(now);
        this.logger.log(
          `membership cycle done: pendingChanges=${pendingChanges.applied}, expiredGrants=${expiredGrants.expiredGrants}, expiredMemberships=${expiredMemberships.expiredMemberships}, cancelledMemberships=${expiredMemberships.cancelledMemberships}, monthlyGrants=${monthlyGrants.grantsCreated}, carryoverGrants=${monthlyGrants.carryoverGrantsCreated}`,
        );
      } catch (error) {
        return { failed: true as const, error };
      }
    });
  }

  async applyPendingMembershipChanges(now = new Date()) {
    const memberships = await this.repository.findPendingMembershipChanges(now);

    let applied = 0;
    let pointsGranted = 0;
    let skippedMissingPlan = 0;
    let skippedExistingGrant = 0;

    for (const membership of memberships) {
      const result = await this.applyPendingMembershipChange(membership, now);
      if (result.applied) applied++;
      if (result.pointsGranted) pointsGranted += result.pointsGranted;
      if (result.skippedMissingPlan) skippedMissingPlan++;
      if (result.skippedExistingGrant) skippedExistingGrant++;
    }

    return { applied, pointsGranted, skippedMissingPlan, skippedExistingGrant };
  }

  async expireMemberships(now = new Date()) {
    const { cancelled, expired } = await this.repository.expireMemberships(now);
    return {
      expiredMemberships: expired.count,
      cancelledMemberships: cancelled.count,
    };
  }

  async grantDueSubscriptionPoints(now = new Date()) {
    const memberships = await this.repository.findActiveMembershipsForSubscriptionPoints(now);

    let grantsCreated = 0;
    let pointsGranted = 0;
    let carryoverGrantsCreated = 0;
    let carryoverPointsGranted = 0;
    let skippedExisting = 0;

    for (const membership of memberships) {
      const cycleIndexes = monthlyCycleIndexesDue(
        membership.startedAt,
        membership.expiresAt,
        now,
      );
      if (cycleIndexes.length === 0) continue;

      const plan = membership.planId
        ? await this.repository.findPlan(membership.planId)
        : null;
      const amount = plan?.points ?? membership.level.pointsPerMonth;
      if (membership.level.level <= 0 || amount <= 0) continue;

      for (const cycleIndex of cycleIndexes) {
        const sourceId = subscriptionCycleSourceId(membership.id, cycleIndex);
        const result = await this.grantMonthlySubscriptionCycle({
          userId: membership.userId,
          membershipId: membership.id,
          planId: membership.planId,
          features: membership.level.features,
          level: membership.level.level,
          levelName: membership.level.name,
          amount,
          cycleIndex,
          sourceId,
          cycleStart: addMonths(membership.startedAt, cycleIndex),
          cycleEnd: minDate(addMonths(membership.startedAt, cycleIndex + 1), membership.expiresAt),
        });

        if (result.created) {
          grantsCreated++;
          pointsGranted += amount;
          if (result.carryoverCreated) {
            carryoverGrantsCreated++;
            carryoverPointsGranted += result.carryoverAmount ?? 0;
          }
        } else {
          skippedExisting++;
        }
      }
    }

    return {
      grantsCreated,
      pointsGranted,
      carryoverGrantsCreated,
      carryoverPointsGranted,
      skippedExisting,
    };
  }

  private async grantMonthlySubscriptionCycle(
    input: MonthlySubscriptionCycleInput,
  ): Promise<MonthlySubscriptionCycleResult> {
    try {
      return await this.runMonthlySubscriptionCycleTx(input);
    } catch (err) {
      // FIX-8: 并发/重试撞上 point_grants 唯一约束(userId,sourceEvent,sourceId)，
      // 说明另一方已发放，幂等地视为"已存在"，不重复发分。
      if ((err as { code?: string })?.code === 'P2002') {
        return { created: false, grantId: null };
      }
      throw err;
    }
  }

  private async runMonthlySubscriptionCycleTx(input: MonthlySubscriptionCycleInput) {
    return this.repository.runTransaction(async (tx) => {
      const existing = await this.repository.findSubscriptionGrantBySourceInTx(
        tx,
        input.sourceId,
      );
      if (existing) {
        return { created: false, grantId: existing.id };
      }

      const carryover = await this.createCarryoverGrantWithinTx(tx, {
        ...input,
        policy: getCarryoverPolicy(input.features, input.level),
      });

      const result = await this.pointsService.grantPointsWithinTx(
        tx,
        input.userId,
        {
          amount: input.amount,
          grantType: PointGrantType.SUBSCRIPTION,
          sourceEvent: PointLedgerEventType.subscription_grant,
          source: PointsSource.MEMBERSHIP,
          sourceId: input.sourceId,
          expiresAt: input.cycleEnd,
          metadata: {
            membershipId: input.membershipId,
            planId: input.planId,
            cycleIndex: input.cycleIndex,
            cycleStart: input.cycleStart.toISOString(),
            cycleEnd: input.cycleEnd.toISOString(),
            scheduledMonthlyGrant: true,
          } satisfies Prisma.InputJsonObject,
          remark: `Membership subscription monthly points grant: ${input.levelName}`,
        },
      );

      return {
        created: true,
        grantId: result.grant.id,
        carryoverCreated: carryover.created,
        carryoverAmount: carryover.amount,
      };
    });
  }

  private async applyPendingMembershipChange(
    membership: {
      id: string;
      userId: string;
      pendingPlanId: string | null;
      pendingOrderId: string | null;
      pendingChangeEffectiveAt: Date | null;
    },
    now: Date,
  ) {
    return this.repository.runTransaction(async (tx) => {
      const current = await this.repository.findMembershipInTx(tx, membership.id);
      if (!current?.pendingPlanId || current.status !== 'ACTIVE') {
        return { applied: false };
      }

      const plan = await this.repository.findPlanWithLevelInTx(tx, current.pendingPlanId);
      if (!plan) {
        await this.repository.clearMissingPendingPlanInTx(tx, current.id);
        return { applied: false, skippedMissingPlan: true };
      }

      const effectiveAt = current.pendingChangeEffectiveAt ?? now;
      const expiresAt = addMonths(effectiveAt, Math.max(1, plan.months));
      const updatedMembership = await this.repository.activatePendingPlanInTx(
        tx,
        current.id,
        {
          levelId: plan.levelId,
          planId: plan.id,
          autoRenew: plan.autoRenew,
          startedAt: effectiveAt,
          expiresAt,
          status: 'ACTIVE',
          cancelAtPeriodEnd: false,
          cancelledAt: null,
          pendingPlanId: null,
          pendingOrderId: null,
          pendingLevelId: null,
          pendingBillingCycle: null,
          pendingAutoRenew: null,
          pendingChangeEffectiveAt: null,
          pendingChangeRequestedAt: null,
        },
      );

      if (plan.level.level <= 0 || plan.points <= 0) {
        return { applied: true, membership: updatedMembership, pointsGranted: 0 };
      }

      const sourceId =
        current.pendingOrderId ??
        `membership-pending:${current.id}:${effectiveAt.toISOString()}`;
      const existing = await this.repository.findSubscriptionGrantBySourceInTx(tx, sourceId);
      if (existing) {
        return {
          applied: true,
          membership: updatedMembership,
          pointsGranted: 0,
          skippedExistingGrant: true,
        };
      }

      await this.pointsService.grantPointsWithinTx(tx, current.userId, {
        amount: plan.points,
        grantType: PointGrantType.SUBSCRIPTION,
        sourceEvent: PointLedgerEventType.subscription_grant,
        source: PointsSource.MEMBERSHIP,
        sourceId,
        expiresAt: minDate(addMonths(effectiveAt, 1), expiresAt),
        metadata: {
          membershipId: current.id,
          planId: plan.id,
          billingCycle: plan.billingCycle,
          scheduledDowngradeActivation: true,
          pendingOrderId: current.pendingOrderId,
          cycleIndex: 0,
          cycleStart: effectiveAt.toISOString(),
          cycleEnd: minDate(addMonths(effectiveAt, 1), expiresAt).toISOString(),
        } satisfies Prisma.InputJsonObject,
        remark: `Membership downgrade next-cycle points: ${plan.level.name}`,
      });

      return { applied: true, membership: updatedMembership, pointsGranted: plan.points };
    });
  }

  private async createCarryoverGrantWithinTx(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      membershipId: string;
      planId: string | null;
      levelName: string;
      amount: number;
      cycleIndex: number;
      cycleStart: Date;
      cycleEnd: Date;
      policy: CarryoverPolicy | null;
    },
  ) {
    if (!input.policy?.enabled || input.policy.maxCycles < 1 || input.policy.maxPoints <= 0) {
      return { created: false, amount: 0 };
    }
    if (input.cycleIndex < 1) return { created: false, amount: 0 };

    const sourceId = carryoverCycleSourceId(input.membershipId, input.cycleIndex);
    const existing = await this.repository.findSubscriptionGrantBySourceInTx(tx, sourceId);
    if (existing) return { created: false, amount: 0 };

    const previousCycleStart = subtractMonths(input.cycleStart, 1);
    const previousGrants = await this.repository.findPreviousSubscriptionGrantsInTx(tx, {
      userId: input.userId,
      previousCycleStart,
      cycleStart: input.cycleStart,
    });
    const { eligibleGrants, carryoverAmount } = selectCarryoverGrants(previousGrants, {
      membershipId: input.membershipId,
      maxPoints: input.policy.maxPoints,
      currentCycleAmount: input.amount,
    });
    if (carryoverAmount <= 0) return { created: false, amount: 0 };

    await this.pointsService.grantPointsWithinTx(tx, input.userId, {
      amount: carryoverAmount,
      grantType: PointGrantType.SUBSCRIPTION,
      sourceEvent: PointLedgerEventType.subscription_grant,
      source: PointsSource.MEMBERSHIP,
      sourceId,
      expiresAt: input.cycleEnd,
      metadata: {
        membershipId: input.membershipId,
        planId: input.planId,
        cycleIndex: input.cycleIndex,
        cycleStart: input.cycleStart.toISOString(),
        cycleEnd: input.cycleEnd.toISOString(),
        carryover: true,
        maxCycles: input.policy.maxCycles,
        maxPoints: input.policy.maxPoints,
        carriedFromGrantIds: eligibleGrants.map((grant) => grant.id),
      } satisfies Prisma.InputJsonObject,
      remark: `Membership subscription points carryover: ${input.levelName}`,
    });

    return { created: true, amount: carryoverAmount };
  }
}
