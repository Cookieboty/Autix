import { Injectable, BadRequestException } from '@nestjs/common';
import { PointsRepository } from '../repositories/points.repository';
import {
  PointGrantType,
  PointLedgerEventType,
  PointsSource,
  Prisma,
} from '../../../platform/prisma/generated';
import {
  GRANT_TYPE_BALANCE_FIELD,
  grantCanBeUsedForTask as grantCanBeUsedForTaskHelper,
  selectGrantsForAmount as selectGrantsForAmountHelper,
  type PointGrantRecord,
} from '../points-grants.helpers';
import {
  assertPositiveAmount as assertPositivePointAmount,
  buildConsumeRecordData,
  buildEarnRecordData,
  buildExpirationBalanceUpdateData,
  buildExpirationRecordData,
  buildGrantCreateData,
  eventToLegacySource as eventToLegacySourceHelper,
  grantTypeForSource,
  ledgerEventForSource,
  presentAccountSummary,
  type GrantPointsInput,
} from './points-ledger.helpers';

export type { GrantPointsInput } from './points-ledger.helpers';

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

    return presentAccountSummary(account, grants);
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
    const grantType = grantTypeForSource(source);
    const sourceEvent = ledgerEventForSource(source);
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
    const grant = await this.pointsRepo.createGrantWithinTx(
      tx,
      buildGrantCreateData(userId, input),
    );

    const points = await this.pointsRepo.upsertBalanceWithinTx(
      tx,
      userId,
      input.grantType,
      input.amount,
      GRANT_TYPE_BALANCE_FIELD[input.grantType],
    );

    await this.pointsRepo.createRecordWithinTx(
      tx,
      buildEarnRecordData({
        userId,
        grantInput: input,
        source,
        grantId: grant.id,
        balance: points.balance,
      }),
    );

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

    await this.pointsRepo.createRecordWithinTx(
      tx,
      buildConsumeRecordData({
        userId,
        amount,
        source,
        sourceId,
        balance: points.balance,
        remark,
      }),
    );

    return points.balance;
  }

  async expireGrants(now = new Date()) {
    return this.pointsRepo.runInTransaction(async (tx) => {
      const grants = await this.pointsRepo.findExpiredGrantsWithinTx(tx, now);
      let expiredAmount = 0;
      for (const grant of grants) {
        expiredAmount += grant.availableAmount;
        // FIX-19: 钳制聚合余额递减额，避免漂移/重复冻结导致 user_points 为负。
        const userPoints = await this.pointsRepo.findBalanceWithinTx(tx, grant.userId);
        const bucketField = GRANT_TYPE_BALANCE_FIELD[grant.grantType] as string;
        const bucketBalance = Number(
          (userPoints as Record<string, unknown>)?.[bucketField] ?? 0,
        );
        const safeAmount = Math.max(
          0,
          Math.min(grant.availableAmount, Number(userPoints?.availableBalance ?? 0), bucketBalance),
        );
        const points = await this.pointsRepo.updateBalanceWithinTx(
          tx,
          grant.userId,
          buildExpirationBalanceUpdateData(grant, safeAmount),
        );
        await this.pointsRepo.expireGrantWithinTx(tx, grant);
        await this.pointsRepo.createRecordWithinTx(
          tx,
          buildExpirationRecordData({ grant, balance: points.balance }),
        );
      }
      return { expiredGrants: grants.length, expiredAmount };
    });
  }

  assertPositiveAmount(amount: number) {
    assertPositivePointAmount(amount);
  }

  eventToLegacySource(event: PointLedgerEventType): PointsSource {
    return eventToLegacySourceHelper(event);
  }

  selectGrantsForAmount(grants: PointGrantRecord[], amount: number) {
    return selectGrantsForAmountHelper(grants, amount);
  }

  grantCanBeUsedForTask(grant: PointGrantRecord, taskType: string) {
    return grantCanBeUsedForTaskHelper(grant, taskType);
  }
}
