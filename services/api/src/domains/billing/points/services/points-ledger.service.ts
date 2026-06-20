import { Injectable, BadRequestException } from '@nestjs/common';
import { PointsRepository } from '../repositories/points.repository';
import {
  PointGrantType,
  PointLedgerEventType,
  PointsSource,
  Prisma,
} from '../../../platform/prisma/generated';

type PointGrantRecord = {
  id: string;
  grantType: PointGrantType;
  availableAmount: number;
  frozenAmount: number;
  expiresAt: Date | null;
  usageScope?: Prisma.JsonValue | null;
};

const GRANT_TYPE_BALANCE_FIELD: Record<PointGrantType, keyof Prisma.user_pointsUpdateInput> = {
  SUBSCRIPTION: 'subscriptionBalance',
  PURCHASED: 'purchasedBalance',
  GIFT: 'giftBalance',
  COMPENSATION: 'compensationBalance',
};

const GRANT_TYPE_PRIORITY: Record<PointGrantType, number> = {
  GIFT: 0,
  SUBSCRIPTION: 1,
  COMPENSATION: 2,
  PURCHASED: 3,
};

const SOURCE_TO_GRANT: Partial<Record<PointsSource, PointGrantType>> = {
  MEMBERSHIP: PointGrantType.SUBSCRIPTION,
  PACKAGE: PointGrantType.PURCHASED,
  INVITATION: PointGrantType.GIFT,
  CAMPAIGN: PointGrantType.GIFT,
  ADMIN_GRANT: PointGrantType.COMPENSATION,
};

const SOURCE_TO_EVENT: Partial<Record<PointsSource, PointLedgerEventType>> = {
  MEMBERSHIP: PointLedgerEventType.subscription_grant,
  PACKAGE: PointLedgerEventType.points_purchase,
  INVITATION: PointLedgerEventType.campaign_bonus,
  CAMPAIGN: PointLedgerEventType.campaign_bonus,
  ADMIN_GRANT: PointLedgerEventType.admin_adjustment,
};

export interface GrantPointsInput {
  amount: number;
  grantType: PointGrantType;
  sourceEvent: PointLedgerEventType;
  sourceId?: string;
  expiresAt?: Date | null;
  usageScope?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
  source?: PointsSource;
  remark?: string;
}

@Injectable()
export class PointsLedgerService {
  constructor(private readonly pointsRepo: PointsRepository) {}

  async getBalance(userId: string) {
    return this.pointsRepo.upsertBalance(userId);
  }

  async getAccountSummary(userId: string) {
    const [account, grants] = await Promise.all([
      this.getBalance(userId),
      this.pointsRepo.findActiveGrants(userId),
    ]);

    return {
      account,
      grants,
      balances: {
        available: account.availableBalance,
        frozen: account.frozenBalance,
        total: account.totalBalance,
        subscription: account.subscriptionBalance,
        purchased: account.purchasedBalance,
        gift: account.giftBalance,
        compensation: account.compensationBalance,
      },
    };
  }

  async getRecords(
    userId: string,
    query: { page?: number; pageSize?: number; source?: PointsSource },
  ) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 50);
    const skip = (page - 1) * pageSize;

    const where: Prisma.points_recordsWhereInput = { userId, status: 'CONFIRMED' };
    if (query.source) where.source = query.source;

    const [items, total] = await Promise.all([
      this.pointsRepo.findRecords(where, { skip, take: pageSize }),
      this.pointsRepo.countRecords(where),
    ]);

    return { items, total, page, pageSize, hasMore: skip + items.length < total };
  }

  async addPoints(
    userId: string,
    amount: number,
    source: PointsSource,
    sourceId?: string,
    remark?: string,
  ): Promise<number> {
    const grantType = SOURCE_TO_GRANT[source] ?? PointGrantType.COMPENSATION;
    const sourceEvent = SOURCE_TO_EVENT[source] ?? PointLedgerEventType.admin_adjustment;
    const grant = await this.grantPoints(userId, {
      amount,
      grantType,
      sourceEvent,
      source,
      sourceId,
      remark,
    });
    return grant.balance;
  }

  async grantPoints(userId: string, input: GrantPointsInput) {
    this.assertPositiveAmount(input.amount);

    return this.pointsRepo.runInTransaction(async (tx) =>
      this.grantPointsWithinTx(tx, userId, input),
    );
  }

  async grantPointsWithinTx(
    tx: Prisma.TransactionClient,
    userId: string,
    input: GrantPointsInput,
  ) {
    this.assertPositiveAmount(input.amount);
    const source = input.source ?? this.eventToLegacySource(input.sourceEvent);
    const grant = await this.pointsRepo.createGrantWithinTx(tx, {
      userId,
      grantType: input.grantType,
      sourceEvent: input.sourceEvent,
      sourceId: input.sourceId,
      totalAmount: input.amount,
      availableAmount: input.amount,
      expiresAt: input.expiresAt ?? null,
      usageScope: input.usageScope,
      metadata: input.metadata,
    });

    const points = await this.pointsRepo.upsertBalanceWithinTx(
      tx,
      userId,
      input.grantType,
      input.amount,
      GRANT_TYPE_BALANCE_FIELD[input.grantType],
    );

    await this.pointsRepo.createRecordWithinTx(tx, {
      userId,
      type: 'EARN',
      amount: input.amount,
      source,
      sourceId: input.sourceId ?? grant.id,
      balance: points.balance,
      remark: input.remark ?? input.sourceEvent,
    });

    return { grant, balance: points.balance };
  }

  async deductPoints(
    userId: string,
    amount: number,
    source: PointsSource,
    sourceId?: string,
    remark?: string,
  ): Promise<number> {
    return this.pointsRepo.runInTransaction((tx) =>
      this.deductWithinTx(tx, userId, amount, source, sourceId, remark),
    );
  }

  async deductWithinTx(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: number,
    source: PointsSource,
    sourceId?: string,
    remark?: string,
    taskType?: string,
  ): Promise<number> {
    this.assertPositiveAmount(amount);

    const grants = await this.pointsRepo.findAvailableGrantsWithinTx(tx, userId);
    const eligibilityTaskType = taskType ?? remark ?? String(source);
    const usableGrants = grants.filter((grant) =>
      this.grantCanBeUsedForTask(grant, eligibilityTaskType),
    );
    const selected = this.selectGrantsForAmount(usableGrants, amount);
    const consumedByType = new Map<PointGrantType, number>();

    for (const item of selected) {
      const updatedGrant = await this.pointsRepo.consumeGrantWithinTx(tx, {
        grantId: item.grant.id,
        amount: item.amount,
      });
      if (updatedGrant === 0) {
        throw new BadRequestException(
          `INSUFFICIENT_GRANT: grant=${item.grant.id} required=${item.amount}`,
        );
      }
      consumedByType.set(
        item.grant.grantType,
        (consumedByType.get(item.grant.grantType) ?? 0) + item.amount,
      );
    }

    const updatedPoints = await this.pointsRepo.consumeBalanceWithinTx(tx, {
      userId,
      amount,
      consumedByType,
    });
    if (updatedPoints === 0) {
      throw new BadRequestException('积分余额不足');
    }

    const points = await this.pointsRepo.findBalanceWithinTx(tx, userId);

    await this.pointsRepo.createRecordWithinTx(tx, {
      userId,
      type: 'CONSUME',
      amount,
      source,
      sourceId,
      balance: points.balance,
      remark,
    });

    return points.balance;
  }

  async expireGrants(now = new Date()) {
    return this.pointsRepo.runInTransaction(async (tx) => {
      const grants = await this.pointsRepo.findExpiredGrantsWithinTx(tx, now);
      let expiredAmount = 0;
      for (const grant of grants) {
        expiredAmount += grant.availableAmount;
        const points = await this.pointsRepo.updateBalanceWithinTx(tx, grant.userId, {
          balance: { decrement: grant.availableAmount },
          availableBalance: { decrement: grant.availableAmount },
          totalBalance: { decrement: grant.availableAmount },
          [GRANT_TYPE_BALANCE_FIELD[grant.grantType]]: {
            decrement: grant.availableAmount,
          },
        });
        await this.pointsRepo.expireGrantWithinTx(tx, grant);
        await this.pointsRepo.createRecordWithinTx(tx, {
          userId: grant.userId,
          type: 'CONSUME',
          amount: grant.availableAmount,
          source: PointsSource.EXPIRATION,
          sourceId: grant.id,
          balance: points.balance,
          remark: PointLedgerEventType.expiration,
        });
      }
      return { expiredGrants: grants.length, expiredAmount };
    });
  }

  assertPositiveAmount(amount: number) {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException('积分数量必须为正整数');
    }
  }

  eventToLegacySource(event: PointLedgerEventType): PointsSource {
    switch (event) {
      case PointLedgerEventType.subscription_grant:
        return PointsSource.MEMBERSHIP;
      case PointLedgerEventType.points_purchase:
        return PointsSource.PACKAGE;
      case PointLedgerEventType.campaign_bonus:
        return PointsSource.CAMPAIGN;
      case PointLedgerEventType.expiration:
        return PointsSource.EXPIRATION;
      default:
        return PointsSource.ADMIN_GRANT;
    }
  }

  selectGrantsForAmount(grants: PointGrantRecord[], amount: number) {
    const ordered = [...grants].sort((a, b) => {
      const aTime = a.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bTime = b.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      if (aTime !== bTime) return aTime - bTime;
      return GRANT_TYPE_PRIORITY[a.grantType] - GRANT_TYPE_PRIORITY[b.grantType];
    });

    let remaining = amount;
    const selected: Array<{ grant: PointGrantRecord; amount: number }> = [];
    for (const grant of ordered) {
      if (remaining <= 0) break;
      const use = Math.min(grant.availableAmount, remaining);
      if (use > 0) {
        selected.push({ grant, amount: use });
        remaining -= use;
      }
    }
    if (remaining > 0) {
      throw new BadRequestException('积分余额不足');
    }
    return selected;
  }

  grantCanBeUsedForTask(grant: PointGrantRecord, taskType: string) {
    const scope = this.normalizeUsageScope(grant.usageScope);
    if (!scope) return true;

    const allowed = this.stringArray(scope.allowedTaskTypes);
    if (allowed.length > 0 && !allowed.includes(taskType)) return false;

    const excluded = this.stringArray(scope.excludedTaskTypes);
    if (excluded.includes(taskType)) return false;

    const allowedPrefixes = this.stringArray(scope.allowedTaskPrefixes);
    if (
      allowedPrefixes.length > 0 &&
      !allowedPrefixes.some((prefix) => taskType.startsWith(prefix))
    ) {
      return false;
    }

    const excludedPrefixes = this.stringArray(scope.excludedTaskPrefixes);
    if (excludedPrefixes.some((prefix) => taskType.startsWith(prefix))) return false;

    return true;
  }

  private normalizeUsageScope(value: Prisma.JsonValue | null | undefined) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  }

  private stringArray(value: unknown) {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  }
}
