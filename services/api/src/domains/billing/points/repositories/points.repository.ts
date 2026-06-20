import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma/prisma.service';
import {
  PointGrantType,
  PointHoldStatus,
  Prisma,
  type user_points,
  type point_grants,
  type point_holds,
  type point_hold_items,
  type points_records,
} from '../../../platform/prisma/generated';

const GRANT_TYPE_BALANCE_FIELD: Record<PointGrantType, keyof Prisma.user_pointsUpdateInput> = {
  SUBSCRIPTION: 'subscriptionBalance',
  PURCHASED: 'purchasedBalance',
  GIFT: 'giftBalance',
  COMPENSATION: 'compensationBalance',
};

type PointHoldWithItems = Prisma.point_holdsGetPayload<{
  include: { items: true };
}>;

@Injectable()
export class PointsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async runInTransaction<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(callback);
  }

  async upsertBalance(userId: string): Promise<user_points> {
    return this.prisma.user_points.upsert({
      where: { userId },
      create: { userId, balance: 0, availableBalance: 0, totalBalance: 0 },
      update: {},
    });
  }

  async findActivePackages() {
    return this.prisma.points_packages.findMany({
      where: { isActive: true },
      orderBy: { sort: 'asc' },
    });
  }

  async findPackageById(id: string) {
    return this.prisma.points_packages.findUnique({ where: { id } });
  }

  async findActiveGrants(userId: string): Promise<point_grants[]> {
    return this.prisma.point_grants.findMany({
      where: {
        userId,
        OR: [{ availableAmount: { gt: 0 } }, { frozenAmount: { gt: 0 } }],
      },
      orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findAvailableGrants(
    userId: string,
    now = new Date(),
  ): Promise<point_grants[]> {
    return this.prisma.point_grants.findMany({
      where: {
        userId,
        availableAmount: { gt: 0 },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findAvailableGrantsWithinTx(
    tx: Prisma.TransactionClient,
    userId: string,
    now = new Date(),
  ): Promise<point_grants[]> {
    return tx.point_grants.findMany({
      where: {
        userId,
        availableAmount: { gt: 0 },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async consumeGrantWithinTx(
    tx: Prisma.TransactionClient,
    input: { grantId: string; amount: number },
  ): Promise<number> {
    const updated = await tx.point_grants.updateMany({
      where: { id: input.grantId, availableAmount: { gte: input.amount } },
      data: {
        availableAmount: { decrement: input.amount },
        consumedAmount: { increment: input.amount },
      },
    });
    return updated.count;
  }

  async findExpiredGrants(now = new Date()): Promise<point_grants[]> {
    return this.prisma.point_grants.findMany({
      where: { expiresAt: { lte: now }, availableAmount: { gt: 0 } },
    });
  }

  async findExpiredGrantsWithinTx(
    tx: Prisma.TransactionClient,
    now = new Date(),
  ): Promise<point_grants[]> {
    return tx.point_grants.findMany({
      where: { expiresAt: { lte: now }, availableAmount: { gt: 0 } },
    });
  }

  async findRecords(
    where: Prisma.points_recordsWhereInput,
    options?: { skip?: number; take?: number },
  ): Promise<points_records[]> {
    return this.prisma.points_records.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: options?.skip,
      take: options?.take,
    });
  }

  async countRecords(where: Prisma.points_recordsWhereInput): Promise<number> {
    return this.prisma.points_records.count({ where });
  }

  async createGrantWithinTx(
    tx: Prisma.TransactionClient,
    data: Prisma.point_grantsUncheckedCreateInput,
  ): Promise<point_grants> {
    return tx.point_grants.create({ data });
  }

  async upsertBalanceWithinTx(
    tx: Prisma.TransactionClient,
    userId: string,
    grantType: PointGrantType,
    amount: number,
    grantTypeField: keyof Prisma.user_pointsUpdateInput,
  ): Promise<user_points> {
    return tx.user_points.upsert({
      where: { userId },
      create: {
        userId,
        balance: amount,
        availableBalance: amount,
        totalBalance: amount,
        [grantTypeField]: amount,
      },
      update: {
        balance: { increment: amount },
        availableBalance: { increment: amount },
        totalBalance: { increment: amount },
        [grantTypeField]: { increment: amount },
      },
    });
  }

  async createRecordWithinTx(
    tx: Prisma.TransactionClient,
    data: Prisma.points_recordsUncheckedCreateInput,
  ): Promise<points_records> {
    return tx.points_records.create({ data });
  }

  async findPendingHoldByTask(input: {
    taskType?: string;
    taskId: string;
  }): Promise<point_holds | null> {
    return this.prisma.point_holds.findFirst({
      where: {
        taskId: input.taskId,
        taskType: input.taskType,
        status: { in: [PointHoldStatus.PENDING, PointHoldStatus.PROCESSING] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createHoldWithinTx(
    tx: Prisma.TransactionClient,
    data: Prisma.point_holdsUncheckedCreateInput,
  ): Promise<point_holds> {
    return tx.point_holds.create({ data });
  }

  async freezeGrantForHoldWithinTx(
    tx: Prisma.TransactionClient,
    input: { grantId: string; amount: number },
  ): Promise<number> {
    const updated = await tx.point_grants.updateMany({
      where: { id: input.grantId, availableAmount: { gte: input.amount } },
      data: {
        availableAmount: { decrement: input.amount },
        frozenAmount: { increment: input.amount },
      },
    });
    return updated.count;
  }

  async createHoldItemWithinTx(
    tx: Prisma.TransactionClient,
    data: Prisma.point_hold_itemsUncheckedCreateInput,
  ): Promise<point_hold_items> {
    return tx.point_hold_items.create({ data });
  }

  async moveBalanceToFrozenWithinTx(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: number,
  ): Promise<number> {
    const updated = await tx.user_points.updateMany({
      where: {
        userId,
        balance: { gte: amount },
        availableBalance: { gte: amount },
      },
      data: {
        balance: { decrement: amount },
        availableBalance: { decrement: amount },
        frozenBalance: { increment: amount },
      },
    });
    return updated.count;
  }

  async claimHoldForProcessingWithinTx(
    tx: Prisma.TransactionClient,
    holdId: string,
  ): Promise<number> {
    const claimed = await tx.point_holds.updateMany({
      where: {
        id: holdId,
        status: { in: [PointHoldStatus.PENDING, PointHoldStatus.PROCESSING] },
      },
      data: { status: PointHoldStatus.PROCESSING },
    });
    return claimed.count;
  }

  async findHoldWithItemsWithinTx(
    tx: Prisma.TransactionClient,
    holdId: string,
  ): Promise<PointHoldWithItems | null> {
    return tx.point_holds.findUnique({
      where: { id: holdId },
      include: { items: true },
    });
  }

  async confirmHeldGrantItemWithinTx(
    tx: Prisma.TransactionClient,
    item: Pick<point_hold_items, 'grantId' | 'amount'>,
    consumeAmount: number,
    refundAmount: number,
  ): Promise<number> {
    const data: Prisma.point_grantsUpdateManyMutationInput = {
      frozenAmount: { decrement: item.amount },
      consumedAmount: { increment: consumeAmount },
    };
    if (refundAmount > 0) {
      data.availableAmount = { increment: refundAmount };
    }

    const updated = await tx.point_grants.updateMany({
      where: { id: item.grantId, frozenAmount: { gte: item.amount } },
      data,
    });
    return updated.count;
  }

  async refundHeldGrantItemWithinTx(
    tx: Prisma.TransactionClient,
    item: Pick<point_hold_items, 'grantId' | 'amount'>,
  ): Promise<number> {
    const updated = await tx.point_grants.updateMany({
      where: { id: item.grantId, frozenAmount: { gte: item.amount } },
      data: {
        frozenAmount: { decrement: item.amount },
        availableAmount: { increment: item.amount },
      },
    });
    return updated.count;
  }

  async confirmHeldBalanceWithinTx(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      estimatedAmount: number;
      confirmedAmount: number;
      refundAmount: number;
      consumedByType: ReadonlyMap<PointGrantType, number>;
    },
  ): Promise<number> {
    const data: Prisma.user_pointsUpdateInput = {
      frozenBalance: { decrement: input.estimatedAmount },
      availableBalance:
        input.refundAmount > 0 ? { increment: input.refundAmount } : undefined,
      balance: input.refundAmount > 0 ? { increment: input.refundAmount } : undefined,
      totalBalance: { decrement: input.confirmedAmount },
    };
    for (const [grantType, amount] of input.consumedByType) {
      data[GRANT_TYPE_BALANCE_FIELD[grantType]] = { decrement: amount } as never;
    }

    const where: Prisma.user_pointsWhereInput = {
      userId: input.userId,
      frozenBalance: { gte: input.estimatedAmount },
    };
    for (const [grantType, amount] of input.consumedByType) {
      (where as Record<string, unknown>)[GRANT_TYPE_BALANCE_FIELD[grantType]] = {
        gte: amount,
      };
    }

    const updated = await tx.user_points.updateMany({ where, data });
    return updated.count;
  }

  async refundHeldBalanceWithinTx(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: number,
  ): Promise<number> {
    const updated = await tx.user_points.updateMany({
      where: { userId, frozenBalance: { gte: amount } },
      data: {
        balance: { increment: amount },
        availableBalance: { increment: amount },
        frozenBalance: { decrement: amount },
      },
    });
    return updated.count;
  }

  async updateHoldWithinTx(
    tx: Prisma.TransactionClient,
    id: string,
    data: Prisma.point_holdsUncheckedUpdateInput,
  ): Promise<point_holds> {
    return tx.point_holds.update({ where: { id }, data });
  }

  async updatePendingHoldRecordWithinTx(
    tx: Prisma.TransactionClient,
    holdId: string,
    data: Prisma.points_recordsUpdateManyMutationInput,
  ): Promise<number> {
    const updated = await tx.points_records.updateMany({
      where: { holdId, status: 'PENDING' },
      data,
    });
    return updated.count;
  }

  async updateGrantWithinTx(
    tx: Prisma.TransactionClient,
    id: string,
    data: Prisma.point_grantsUpdateInput,
  ): Promise<point_grants> {
    return tx.point_grants.update({ where: { id }, data });
  }

  async expireGrantWithinTx(
    tx: Prisma.TransactionClient,
    grant: Pick<point_grants, 'id' | 'availableAmount'>,
  ): Promise<point_grants> {
    return tx.point_grants.update({
      where: { id: grant.id },
      data: {
        expiredAmount: { increment: grant.availableAmount },
        availableAmount: 0,
      },
    });
  }

  async consumeBalanceWithinTx(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      amount: number;
      consumedByType: ReadonlyMap<PointGrantType, number>;
    },
  ): Promise<number> {
    const where: Prisma.user_pointsWhereInput = {
      userId: input.userId,
      balance: { gte: input.amount },
      availableBalance: { gte: input.amount },
    };
    const data: Prisma.user_pointsUpdateInput = {
      balance: { decrement: input.amount },
      availableBalance: { decrement: input.amount },
      totalBalance: { decrement: input.amount },
    };
    for (const [grantType, consumedAmount] of input.consumedByType) {
      (where as Record<string, unknown>)[GRANT_TYPE_BALANCE_FIELD[grantType]] = {
        gte: consumedAmount,
      };
      data[GRANT_TYPE_BALANCE_FIELD[grantType]] = {
        decrement: consumedAmount,
      } as never;
    }

    const updated = await tx.user_points.updateMany({ where, data });
    return updated.count;
  }

  async updateBalanceWithinTx(
    tx: Prisma.TransactionClient,
    userId: string,
    data: Prisma.user_pointsUpdateInput,
  ): Promise<user_points> {
    return tx.user_points.update({ where: { userId }, data });
  }

  async findBalanceWithinTx(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<user_points> {
    return tx.user_points.findUniqueOrThrow({ where: { userId } });
  }
}
