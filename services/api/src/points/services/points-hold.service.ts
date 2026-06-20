import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PointsLedgerService } from './points-ledger.service';
import {
  PointGrantType,
  PointHoldStatus,
  PointLedgerEventType,
  PointsSource,
  Prisma,
} from '../../prisma/generated';

const GRANT_TYPE_BALANCE_FIELD: Record<PointGrantType, keyof Prisma.user_pointsUpdateInput> = {
  SUBSCRIPTION: 'subscriptionBalance',
  PURCHASED: 'purchasedBalance',
  GIFT: 'giftBalance',
  COMPENSATION: 'compensationBalance',
};

interface CreateHoldInput {
  taskType: string;
  taskId?: string;
  source?: PointsSource;
  amount: number;
  pricingSnapshot?: Prisma.InputJsonValue;
  refundPolicySnapshot?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
  remark?: string;
}

interface FindHoldByTaskInput {
  taskType?: string;
  taskId: string;
}

@Injectable()
export class PointsHoldService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: PointsLedgerService,
  ) {}

  async createHold(userId: string, input: CreateHoldInput) {
    this.ledgerService.assertPositiveAmount(input.amount);

    return this.prisma.$transaction(async (tx) => {
      const grants = await tx.point_grants.findMany({
        where: {
          userId,
          availableAmount: { gt: 0 },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }],
      });
      const usableGrants = grants.filter((grant) =>
        this.ledgerService.grantCanBeUsedForTask(grant, input.taskType),
      );
      const selected = this.ledgerService.selectGrantsForAmount(usableGrants, input.amount);

      const hold = await tx.point_holds.create({
        data: {
          userId,
          taskType: input.taskType,
          taskId: input.taskId,
          estimatedAmount: input.amount,
          status: PointHoldStatus.PENDING,
          pricingSnapshot: input.pricingSnapshot,
          refundPolicySnapshot: input.refundPolicySnapshot,
          metadata: input.metadata,
        },
      });

      for (const item of selected) {
        const updated = await tx.point_grants.updateMany({
          where: { id: item.grant.id, availableAmount: { gte: item.amount } },
          data: {
            availableAmount: { decrement: item.amount },
            frozenAmount: { increment: item.amount },
          },
        });
        if (updated.count === 0) {
          throw new BadRequestException(
            `INSUFFICIENT_GRANT: grant=${item.grant.id} required=${item.amount}`,
          );
        }
        await tx.point_hold_items.create({
          data: {
            holdId: hold.id,
            grantId: item.grant.id,
            amount: item.amount,
            grantType: item.grant.grantType,
            expiresAt: item.grant.expiresAt,
          },
        });
      }

      const updatedPoints = await tx.user_points.updateMany({
        where: {
          userId,
          balance: { gte: input.amount },
          availableBalance: { gte: input.amount },
        },
        data: {
          balance: { decrement: input.amount },
          availableBalance: { decrement: input.amount },
          frozenBalance: { increment: input.amount },
        },
      });
      if (updatedPoints.count === 0) {
        throw new BadRequestException('积分余额不足');
      }
      const points = await tx.user_points.findUniqueOrThrow({ where: { userId } });

      await tx.points_records.create({
        data: {
          userId,
          type: 'CONSUME',
          amount: input.amount,
          source: input.source ?? PointsSource.TASK,
          sourceId: input.taskId ?? hold.id,
          balance: points.balance,
          status: 'PENDING',
          holdId: hold.id,
          remark: input.remark ?? `generation_freeze:${input.taskType}`,
        },
      });

      return { hold, balance: points.balance };
    });
  }

  async findPendingHoldByTask(input: FindHoldByTaskInput) {
    return this.prisma.point_holds.findFirst({
      where: {
        taskId: input.taskId,
        taskType: input.taskType,
        status: { in: [PointHoldStatus.PENDING, PointHoldStatus.PROCESSING] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async confirmHold(holdId: string, actualAmount?: number) {
    return this.prisma.$transaction((tx) =>
      this.confirmHoldWithinTx(tx, holdId, actualAmount),
    );
  }

  async confirmHoldWithinTx(
    tx: Prisma.TransactionClient,
    holdId: string,
    actualAmount?: number,
  ) {
    if (
      actualAmount !== undefined &&
      (!Number.isInteger(actualAmount) || actualAmount < 0)
    ) {
      throw new BadRequestException('确认扣费金额必须为非负整数');
    }

    const claimed = await tx.point_holds.updateMany({
      where: {
        id: holdId,
        status: { in: [PointHoldStatus.PENDING, PointHoldStatus.PROCESSING] },
      },
      data: { status: PointHoldStatus.PROCESSING },
    });
    if (claimed.count === 0) {
      const existing = await tx.point_holds.findUnique({
        where: { id: holdId },
        include: { items: true },
      });
      if (!existing) throw new BadRequestException('积分冻结不存在');
      if (
        existing.status === PointHoldStatus.CONFIRMED ||
        existing.status === PointHoldStatus.PARTIALLY_REFUNDED ||
        existing.status === PointHoldStatus.REFUNDED
      ) {
        return { confirmed: false, hold: existing };
      }
      throw new BadRequestException('当前冻结状态不能确认扣费');
    }

    const hold = await tx.point_holds.findUnique({
      where: { id: holdId },
      include: { items: true },
    });
    if (!hold) throw new BadRequestException('积分冻结不存在');
    if (hold.status !== PointHoldStatus.PROCESSING) {
      throw new BadRequestException('当前冻结状态不能确认扣费');
    }

    const confirmedAmount = actualAmount ?? hold.estimatedAmount;
    if (confirmedAmount > hold.estimatedAmount) {
      throw new BadRequestException('确认扣费不能超过冻结金额');
    }

    let remainingToConsume = confirmedAmount;
    const refundAmount = hold.estimatedAmount - confirmedAmount;
    const consumedByType = new Map<PointGrantType, number>();

    for (const item of hold.items) {
      const consumeAmount = Math.min(item.amount, remainingToConsume);
      const itemRefundAmount = item.amount - consumeAmount;
      remainingToConsume -= consumeAmount;
      if (consumeAmount > 0) {
        consumedByType.set(
          item.grantType,
          (consumedByType.get(item.grantType) ?? 0) + consumeAmount,
        );
      }

      const grantData: Prisma.point_grantsUpdateManyMutationInput = {
        frozenAmount: { decrement: item.amount },
        consumedAmount: { increment: consumeAmount },
      };
      if (itemRefundAmount > 0) {
        grantData.availableAmount = { increment: itemRefundAmount };
      }
      const updatedGrant = await tx.point_grants.updateMany({
        where: { id: item.grantId, frozenAmount: { gte: item.amount } },
        data: grantData,
      });
      if (updatedGrant.count === 0) {
        throw new BadRequestException(
          `INSUFFICIENT_FROZEN_GRANT: grant=${item.grantId} required=${item.amount}`,
        );
      }
    }

    const balanceData: Prisma.user_pointsUpdateInput = {
      frozenBalance: { decrement: hold.estimatedAmount },
      availableBalance: refundAmount > 0 ? { increment: refundAmount } : undefined,
      balance: refundAmount > 0 ? { increment: refundAmount } : undefined,
      totalBalance: { decrement: confirmedAmount },
    };
    for (const [grantType, amount] of consumedByType) {
      balanceData[GRANT_TYPE_BALANCE_FIELD[grantType]] = { decrement: amount } as never;
    }

    const balanceWhere: Prisma.user_pointsWhereInput = {
      userId: hold.userId,
      frozenBalance: { gte: hold.estimatedAmount },
    };
    for (const [grantType, amount] of consumedByType) {
      (balanceWhere as Record<string, unknown>)[GRANT_TYPE_BALANCE_FIELD[grantType]] = {
        gte: amount,
      };
    }
    const updatedPoints = await tx.user_points.updateMany({
      where: balanceWhere,
      data: balanceData,
    });
    if (updatedPoints.count === 0) {
      throw new BadRequestException('积分冻结余额不足');
    }
    const points = await tx.user_points.findUniqueOrThrow({ where: { userId: hold.userId } });

    const status =
      confirmedAmount === 0
        ? PointHoldStatus.REFUNDED
        : refundAmount > 0
          ? PointHoldStatus.PARTIALLY_REFUNDED
          : PointHoldStatus.CONFIRMED;
    const updatedHold = await tx.point_holds.update({
      where: { id: holdId },
      data: {
        status,
        confirmedAmount,
        confirmedAt: new Date(),
        refundedAt: refundAmount > 0 ? new Date() : undefined,
      },
    });

    const updatedRecord = await tx.points_records.updateMany({
      where: { holdId, status: 'PENDING' },
      data: {
        status:
          status === PointHoldStatus.REFUNDED ? 'REFUNDED' : 'CONFIRMED',
        amount: confirmedAmount,
        balance: points.balance,
        remark:
          status === PointHoldStatus.REFUNDED
            ? PointLedgerEventType.generation_refund
            : PointLedgerEventType.generation_cost,
      },
    });
    if (updatedRecord.count === 0) {
      throw new BadRequestException('积分冻结流水不存在');
    }

    return { confirmed: true, hold: updatedHold, balance: points.balance };
  }

  async refundHold(holdId: string, reason: string) {
    return this.prisma.$transaction((tx) =>
      this.refundHoldWithinTx(tx, holdId, reason),
    );
  }

  async refundHoldWithinTx(
    tx: Prisma.TransactionClient,
    holdId: string,
    reason: string,
  ) {
    const claimed = await tx.point_holds.updateMany({
      where: {
        id: holdId,
        status: { in: [PointHoldStatus.PENDING, PointHoldStatus.PROCESSING] },
      },
      data: { status: PointHoldStatus.PROCESSING },
    });
    if (claimed.count === 0) {
      const existing = await tx.point_holds.findUnique({
        where: { id: holdId },
        include: { items: true },
      });
      if (!existing) throw new BadRequestException('积分冻结不存在');
      if (existing.status === PointHoldStatus.REFUNDED) {
        return { refunded: false, amount: 0, hold: existing };
      }
      throw new BadRequestException('当前冻结状态不能退款');
    }

    const hold = await tx.point_holds.findUnique({
      where: { id: holdId },
      include: { items: true },
    });
    if (!hold) throw new BadRequestException('积分冻结不存在');
    if (hold.status !== PointHoldStatus.PROCESSING) {
      throw new BadRequestException('当前冻结状态不能退款');
    }

    const amount = hold.items.reduce((sum, item) => sum + item.amount, 0);
    for (const item of hold.items) {
      const updatedGrant = await tx.point_grants.updateMany({
        where: { id: item.grantId, frozenAmount: { gte: item.amount } },
        data: {
          frozenAmount: { decrement: item.amount },
          availableAmount: { increment: item.amount },
        },
      });
      if (updatedGrant.count === 0) {
        throw new BadRequestException(
          `INSUFFICIENT_FROZEN_GRANT: grant=${item.grantId} required=${item.amount}`,
        );
      }
    }

    const updatedPoints = await tx.user_points.updateMany({
      where: { userId: hold.userId, frozenBalance: { gte: amount } },
      data: {
        balance: { increment: amount },
        availableBalance: { increment: amount },
        frozenBalance: { decrement: amount },
      },
    });
    if (updatedPoints.count === 0) {
      throw new BadRequestException('积分冻结余额不足');
    }
    const points = await tx.user_points.findUniqueOrThrow({ where: { userId: hold.userId } });

    const updatedHold = await tx.point_holds.update({
      where: { id: holdId },
      data: {
        status: PointHoldStatus.REFUNDED,
        confirmedAmount: 0,
        refundedAt: new Date(),
      },
    });
    const updatedRecord = await tx.points_records.updateMany({
      where: { holdId, status: 'PENDING' },
      data: {
        status: 'REFUNDED',
        balance: points.balance,
        remark: `refund: ${reason}`,
      },
    });
    if (updatedRecord.count === 0) {
      throw new BadRequestException('积分冻结流水不存在');
    }

    return { refunded: true, amount, hold: updatedHold, balance: points.balance };
  }
}
