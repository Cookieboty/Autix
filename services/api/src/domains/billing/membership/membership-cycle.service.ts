import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PointsService } from '../points/points.service';
import { PointGrantType, PointLedgerEventType, PointsSource, Prisma } from '../../platform/prisma/generated';
import { MembershipRepository } from './membership.repository';

function addMonths(from: Date, months: number) {
  const date = new Date(from);
  const day = date.getDate();
  date.setMonth(date.getMonth() + months);
  if (date.getDate() !== day) date.setDate(0);
  return date;
}

function subtractMonths(from: Date, months: number) {
  return addMonths(from, -months);
}

function minDate(a: Date, b: Date) {
  return a.getTime() <= b.getTime() ? a : b;
}

function monthlyCycleIndexesDue(startedAt: Date, expiresAt: Date, now: Date) {
  const indexes: number[] = [];
  for (let index = 1; index <= 120; index++) {
    const cycleStart = addMonths(startedAt, index);
    const cycleEnd = minDate(addMonths(startedAt, index + 1), expiresAt);
    if (cycleStart > now || cycleStart >= expiresAt) break;
    if (cycleEnd <= now) continue;
    indexes.push(index);
  }
  return indexes;
}

type CarryoverPolicy = {
  enabled: boolean;
  maxCycles: number;
  maxPoints: number;
};

// P1-4: 结转最多可跨多少个周期的安全上限。
// 原先 `Math.min(1, maxCycles)` 永远 ≤1，导致 features.maxCycles 配置形同虚设；
// 修复后采用 min(features.maxCycles, POINTS_CARRYOVER_MAX_CYCLES) 来兜底，
// 防止管理员误配过大的 maxCycles 引起结转链路无限放大。
const POINTS_CARRYOVER_MAX_CYCLES = 12;

@Injectable()
export class MembershipCycleService {
  private readonly logger = new Logger(MembershipCycleService.name);

  constructor(
    private readonly repository: MembershipRepository,
    private readonly pointsService: PointsService,
  ) { }

  @Cron('0 2 * * *')
  async runDailyCycle() {
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
      this.logger.error('membership cycle failed', error);
    }
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
        const sourceId = this.subscriptionCycleSourceId(membership.id, cycleIndex);
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
            carryoverPointsGranted += result.carryoverAmount;
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

  private async grantMonthlySubscriptionCycle(input: {
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
  }) {
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
        policy: this.getCarryoverPolicy(input.features, input.level),
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
          remark: `会员订阅积分月度发放: ${input.levelName}`,
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
        remark: `会员降级下周期生效积分: ${plan.level.name}`,
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

    const sourceId = `membership-carryover:${input.membershipId}:${input.cycleIndex}`;
    const existing = await this.repository.findSubscriptionGrantBySourceInTx(tx, sourceId);
    if (existing) return { created: false, amount: 0 };

    const previousCycleStart = subtractMonths(input.cycleStart, 1);
    const previousGrants = await this.repository.findPreviousSubscriptionGrantsInTx(tx, {
      userId: input.userId,
      previousCycleStart,
      cycleStart: input.cycleStart,
    });
    const eligibleGrants = previousGrants.filter((grant) => {
      const metadata = this.asObject(grant.metadata);
      return metadata?.membershipId === input.membershipId && metadata?.carryover !== true;
    });
    const availableAmount = eligibleGrants.reduce((sum, grant) => sum + grant.availableAmount, 0);
    const carryoverAmount = Math.min(
      availableAmount,
      input.policy.maxPoints,
      input.amount,
    );
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
      remark: `会员订阅积分结转: ${input.levelName}`,
    });

    return { created: true, amount: carryoverAmount };
  }

  private getCarryoverPolicy(features: Prisma.JsonValue | null, level: number): CarryoverPolicy | null {
    const object = this.asObject(features);
    const rawPolicy = this.asObject(object?.pointsCarryover);
    const enabled = rawPolicy?.enabled === true;
    if (!enabled) return null;

    const maxCycles = this.positiveNumber(rawPolicy.maxCycles, 1);
    const maxPoints = this.positiveNumber(rawPolicy.maxPoints, 0);
    if (level < 3 || maxCycles < 1 || maxPoints <= 0) return null;
    return {
      enabled: true,
      // P1-4: 取 features 中的 maxCycles 与结构化安全上限 POINTS_CARRYOVER_MAX_CYCLES 的较小者
      maxCycles: Math.min(maxCycles, POINTS_CARRYOVER_MAX_CYCLES),
      maxPoints,
    };
  }

  private asObject(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  }

  private positiveNumber(value: unknown, fallback: number) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return fallback;
    return Math.floor(value);
  }

  private subscriptionCycleSourceId(membershipId: string, cycleIndex: number) {
    return `membership-cycle:${membershipId}:${cycleIndex}`;
  }
}
