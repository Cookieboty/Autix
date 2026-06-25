import { Injectable } from '@nestjs/common';
import { OrderRepository } from '../repositories/order.repository';
import {
  OrderType,
  PointLedgerEventType,
  PointsSource,
  Prisma,
  type orders,
} from '../../../platform/prisma/generated';
import { GRANT_TYPE_BALANCE_FIELD } from '../../points/points-grants.helpers';

const REFUNDABLE_ORDER_GRANT_EVENTS = [
  PointLedgerEventType.subscription_grant,
  PointLedgerEventType.points_purchase,
  PointLedgerEventType.campaign_bonus,
];

@Injectable()
export class OrderPointReclaimService {
  constructor(private readonly orderRepo: OrderRepository) {}

  async reclaimAvailableOrderPointsWithinTx(
    tx: Prisma.TransactionClient,
    order: orders,
    reason: string,
    policy: { reclaimPoints?: boolean; maxPointsToReclaim?: number } = {},
  ) {
    if (policy.reclaimPoints === false) {
      return {
        pointsReclaimed: 0,
        skippedConsumedPoints: 0,
        skippedFrozenPoints: 0,
        skippedExpiredPoints: 0,
      };
    }

    const grants = await this.orderRepo.findPointGrantsByOrderEventsWithinTx(
      tx,
      order.id,
      REFUNDABLE_ORDER_GRANT_EVENTS,
    );
    let remaining =
      policy.maxPointsToReclaim !== undefined
        ? Math.max(0, Math.floor(policy.maxPointsToReclaim))
        : Number.MAX_SAFE_INTEGER;
    let pointsReclaimed = 0;
    let skippedConsumedPoints = 0;
    let skippedFrozenPoints = 0;
    let skippedExpiredPoints = 0;

    for (const grant of grants) {
      skippedConsumedPoints += grant.consumedAmount;
      skippedFrozenPoints += grant.frozenAmount;
      skippedExpiredPoints += grant.expiredAmount;
      if (remaining <= 0 || grant.availableAmount <= 0) continue;

      // FIX-19: 将回收额钳制在用户实际余额内，避免跨 grant 账目漂移时把 user_points 压成负数；
      // grant 与聚合余额按同一安全额递减，保持一致。
      const userPoints = await this.orderRepo.findUserPointsWithinTx(tx, grant.userId);
      const bucketField = GRANT_TYPE_BALANCE_FIELD[grant.grantType] as string;
      const bucketBalance = Number((userPoints as Record<string, unknown> | null)?.[bucketField] ?? 0);
      const availableBalance = Number(userPoints?.availableBalance ?? 0);
      const reclaimAmount = Math.max(
        0,
        Math.min(grant.availableAmount, remaining, availableBalance, bucketBalance),
      );
      if (reclaimAmount <= 0) continue;
      remaining -= reclaimAmount;
      pointsReclaimed += reclaimAmount;

      await this.orderRepo.updatePointGrantWithinTx(tx, grant.id, {
        availableAmount: { decrement: reclaimAmount },
        refundedAmount: { increment: reclaimAmount },
      });

      const points = await this.orderRepo.updateUserPointsWithinTx(tx, grant.userId, {
        balance: { decrement: reclaimAmount },
        availableBalance: { decrement: reclaimAmount },
        totalBalance: { decrement: reclaimAmount },
        [GRANT_TYPE_BALANCE_FIELD[grant.grantType]]: { decrement: reclaimAmount },
      });

      await this.orderRepo.createPointsRecordWithinTx(tx, {
        userId: grant.userId,
        type: 'CONSUME',
        amount: reclaimAmount,
        source:
          order.orderType === OrderType.POINTS_PACKAGE
            ? PointsSource.PACKAGE
            : PointsSource.MEMBERSHIP,
        sourceId: order.id,
        balance: points.balance,
        remark: `refund_order:${reason}`,
      });
    }

    return {
      pointsReclaimed,
      skippedConsumedPoints,
      skippedFrozenPoints,
      skippedExpiredPoints,
    };
  }
}
