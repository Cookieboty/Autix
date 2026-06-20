import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma/prisma.service';
import { PointsRepository } from '../repositories/points.repository';
import { PointsLedgerService } from './points-ledger.service';
import {
  PointGrantType,
  PointHoldStatus,
  PointLedgerEventType,
  PointsSource,
  Prisma,
} from '../../../platform/prisma/generated';

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
    private readonly pointsRepo: PointsRepository,
    private readonly ledgerService: PointsLedgerService,
  ) {}

  async createHold(userId: string, input: CreateHoldInput) {
    this.ledgerService.assertPositiveAmount(input.amount);

    return this.prisma.$transaction(async (tx) => {
      const grants = await this.pointsRepo.findAvailableGrantsWithinTx(tx, userId);
      const usableGrants = grants.filter((grant) =>
        this.ledgerService.grantCanBeUsedForTask(grant, input.taskType),
      );
      const selected = this.ledgerService.selectGrantsForAmount(usableGrants, input.amount);

      const hold = await this.pointsRepo.createHoldWithinTx(tx, {
        userId,
        taskType: input.taskType,
        taskId: input.taskId,
        estimatedAmount: input.amount,
        status: PointHoldStatus.PENDING,
        pricingSnapshot: input.pricingSnapshot,
        refundPolicySnapshot: input.refundPolicySnapshot,
        metadata: input.metadata,
      });

      for (const item of selected) {
        const updated = await this.pointsRepo.freezeGrantForHoldWithinTx(tx, {
          grantId: item.grant.id,
          amount: item.amount,
        });
        if (updated === 0) {
          throw new BadRequestException(
            `INSUFFICIENT_GRANT: grant=${item.grant.id} required=${item.amount}`,
          );
        }
        await this.pointsRepo.createHoldItemWithinTx(tx, {
          holdId: hold.id,
          grantId: item.grant.id,
          amount: item.amount,
          grantType: item.grant.grantType,
          expiresAt: item.grant.expiresAt,
        });
      }

      const updatedPoints = await this.pointsRepo.moveBalanceToFrozenWithinTx(
        tx,
        userId,
        input.amount,
      );
      if (updatedPoints === 0) {
        throw new BadRequestException('积分余额不足');
      }
      const points = await this.pointsRepo.findBalanceWithinTx(tx, userId);

      await this.pointsRepo.createRecordWithinTx(tx, {
        userId,
        type: 'CONSUME',
        amount: input.amount,
        source: input.source ?? PointsSource.TASK,
        sourceId: input.taskId ?? hold.id,
        balance: points.balance,
        status: 'PENDING',
        holdId: hold.id,
        remark: input.remark ?? `generation_freeze:${input.taskType}`,
      });

      return { hold, balance: points.balance };
    });
  }

  async findPendingHoldByTask(input: FindHoldByTaskInput) {
    return this.pointsRepo.findPendingHoldByTask(input);
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

    const claimed = await this.pointsRepo.claimHoldForProcessingWithinTx(tx, holdId);
    if (claimed === 0) {
      const existing = await this.pointsRepo.findHoldWithItemsWithinTx(tx, holdId);
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

    const hold = await this.pointsRepo.findHoldWithItemsWithinTx(tx, holdId);
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

      const updatedGrant = await this.pointsRepo.confirmHeldGrantItemWithinTx(
        tx,
        item,
        consumeAmount,
        itemRefundAmount,
      );
      if (updatedGrant === 0) {
        throw new BadRequestException(
          `INSUFFICIENT_FROZEN_GRANT: grant=${item.grantId} required=${item.amount}`,
        );
      }
    }

    const updatedPoints = await this.pointsRepo.confirmHeldBalanceWithinTx(tx, {
      userId: hold.userId,
      estimatedAmount: hold.estimatedAmount,
      confirmedAmount,
      refundAmount,
      consumedByType,
    });
    if (updatedPoints === 0) {
      throw new BadRequestException('积分冻结余额不足');
    }
    const points = await this.pointsRepo.findBalanceWithinTx(tx, hold.userId);

    const status =
      confirmedAmount === 0
        ? PointHoldStatus.REFUNDED
        : refundAmount > 0
          ? PointHoldStatus.PARTIALLY_REFUNDED
          : PointHoldStatus.CONFIRMED;
    const updatedHold = await this.pointsRepo.updateHoldWithinTx(tx, holdId, {
      status,
      confirmedAmount,
      confirmedAt: new Date(),
      refundedAt: refundAmount > 0 ? new Date() : undefined,
    });

    const updatedRecord = await this.pointsRepo.updatePendingHoldRecordWithinTx(tx, holdId, {
      status: status === PointHoldStatus.REFUNDED ? 'REFUNDED' : 'CONFIRMED',
      amount: confirmedAmount,
      balance: points.balance,
      remark:
        status === PointHoldStatus.REFUNDED
          ? PointLedgerEventType.generation_refund
          : PointLedgerEventType.generation_cost,
    });
    if (updatedRecord === 0) {
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
    const claimed = await this.pointsRepo.claimHoldForProcessingWithinTx(tx, holdId);
    if (claimed === 0) {
      const existing = await this.pointsRepo.findHoldWithItemsWithinTx(tx, holdId);
      if (!existing) throw new BadRequestException('积分冻结不存在');
      if (existing.status === PointHoldStatus.REFUNDED) {
        return { refunded: false, amount: 0, hold: existing };
      }
      throw new BadRequestException('当前冻结状态不能退款');
    }

    const hold = await this.pointsRepo.findHoldWithItemsWithinTx(tx, holdId);
    if (!hold) throw new BadRequestException('积分冻结不存在');
    if (hold.status !== PointHoldStatus.PROCESSING) {
      throw new BadRequestException('当前冻结状态不能退款');
    }

    const amount = hold.items.reduce((sum, item) => sum + item.amount, 0);
    for (const item of hold.items) {
      const updatedGrant = await this.pointsRepo.refundHeldGrantItemWithinTx(tx, item);
      if (updatedGrant === 0) {
        throw new BadRequestException(
          `INSUFFICIENT_FROZEN_GRANT: grant=${item.grantId} required=${item.amount}`,
        );
      }
    }

    const updatedPoints = await this.pointsRepo.refundHeldBalanceWithinTx(
      tx,
      hold.userId,
      amount,
    );
    if (updatedPoints === 0) {
      throw new BadRequestException('积分冻结余额不足');
    }
    const points = await this.pointsRepo.findBalanceWithinTx(tx, hold.userId);

    const updatedHold = await this.pointsRepo.updateHoldWithinTx(tx, holdId, {
      status: PointHoldStatus.REFUNDED,
      confirmedAmount: 0,
      refundedAt: new Date(),
    });
    const updatedRecord = await this.pointsRepo.updatePendingHoldRecordWithinTx(tx, holdId, {
      status: 'REFUNDED',
      balance: points.balance,
      remark: `refund: ${reason}`,
    });
    if (updatedRecord === 0) {
      throw new BadRequestException('积分冻结流水不存在');
    }

    return { refunded: true, amount, hold: updatedHold, balance: points.balance };
  }
}
