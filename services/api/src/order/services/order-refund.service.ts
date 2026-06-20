import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderRepository } from '../repositories/order.repository';
import { PaymentEventRepository } from '../repositories/payment-event.repository';
import {
  OrderStatus,
  OrderType,
  PointGrantType,
  PointLedgerEventType,
  PointsSource,
  Prisma,
  type orders,
} from '../../prisma/generated';

const DEFAULT_PAYMENT_CURRENCY = 'USD';

const GRANT_TYPE_BALANCE_FIELD: Record<PointGrantType, keyof Prisma.user_pointsUpdateInput> = {
  SUBSCRIPTION: 'subscriptionBalance',
  PURCHASED: 'purchasedBalance',
  GIFT: 'giftBalance',
  COMPENSATION: 'compensationBalance',
};

const REFUNDABLE_ORDER_GRANT_EVENTS = [
  PointLedgerEventType.subscription_grant,
  PointLedgerEventType.points_purchase,
  PointLedgerEventType.campaign_bonus,
];

type RefundOrderInput = {
  provider?: string;
  externalRefundId?: string;
  amount?: Prisma.Decimal | number | string | null;
  currency?: string;
  reclaimPoints?: boolean;
  maxPointsToReclaim?: number;
  reason?: string;
  metadata?: unknown;
};

@Injectable()
export class OrderRefundService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderRepo: OrderRepository,
    private readonly paymentEventRepo: PaymentEventRepository,
  ) {}

  async refundOrder(id: string, input: RefundOrderInput = {}) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.orders.findUnique({ where: { id } });
      if (!order) throw new NotFoundException('订单不存在');
      if (order.status === OrderStatus.REFUNDED) {
        return {
          order,
          alreadyRefunded: true,
          pointsReclaimed: 0,
          skippedConsumedPoints: 0,
          skippedFrozenPoints: 0,
        };
      }
      if (order.status !== OrderStatus.PAID) {
        throw new BadRequestException('只有已支付订单可以退款');
      }

      const pointRecovery = await this.reclaimAvailableOrderPointsWithinTx(
        tx,
        order,
        input.reason ?? 'order refund',
        {
          reclaimPoints: input.reclaimPoints,
          maxPointsToReclaim: input.maxPointsToReclaim,
        },
      );

      await tx.user_memberships.updateMany({
        where: { userId: order.userId, pendingOrderId: order.id },
        data: {
          pendingPlanId: null,
          pendingOrderId: null,
          pendingLevelId: null,
          pendingBillingCycle: null,
          pendingAutoRenew: null,
          pendingChangeEffectiveAt: null,
          pendingChangeRequestedAt: null,
        },
      });

      const refundProvider = input.provider ?? 'admin_manual';
      const externalRefundId = input.externalRefundId ?? `manual-refund:${order.id}`;
      await this.paymentEventRepo.upsertRefundEventWithinTx(tx, {
        provider: refundProvider,
        externalRefundId,
        orderId: order.id,
        userId: order.userId,
        orderNo: order.orderNo,
        externalPaymentId: order.externalPaymentId,
        amount: this.optionalDecimal(input.amount) ?? order.paidAmount ?? order.amount,
        currency: order.currency ?? input.currency ?? DEFAULT_PAYMENT_CURRENCY,
        metadata: input.metadata,
      });

      const refundMetadata = this.mergeJsonObjects(input.metadata, {
        pointsReclaimed: pointRecovery.pointsReclaimed,
        skippedConsumedPoints: pointRecovery.skippedConsumedPoints,
        skippedFrozenPoints: pointRecovery.skippedFrozenPoints,
      });

      const refundedOrder = await tx.orders.update({
        where: { id },
        data: {
          status: OrderStatus.REFUNDED,
          refundProvider,
          externalRefundId,
          refundAmount: this.optionalDecimal(input.amount) ?? order.paidAmount ?? order.amount,
          refundReason: input.reason ?? 'order refund',
          refundMetadata,
          refundedAt: new Date(),
        },
      });

      return {
        order: refundedOrder,
        alreadyRefunded: false,
        ...pointRecovery,
      };
    });
  }

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

    const grants = await tx.point_grants.findMany({
      where: {
        sourceId: order.id,
        sourceEvent: { in: REFUNDABLE_ORDER_GRANT_EVENTS },
      },
      orderBy: { createdAt: 'asc' },
    });
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

      const reclaimAmount = Math.min(grant.availableAmount, remaining);
      remaining -= reclaimAmount;
      pointsReclaimed += reclaimAmount;

      await tx.point_grants.update({
        where: { id: grant.id },
        data: {
          availableAmount: { decrement: reclaimAmount },
          refundedAmount: { increment: reclaimAmount },
        },
      });

      const points = await tx.user_points.update({
        where: { userId: grant.userId },
        data: {
          balance: { decrement: reclaimAmount },
          availableBalance: { decrement: reclaimAmount },
          totalBalance: { decrement: reclaimAmount },
          [GRANT_TYPE_BALANCE_FIELD[grant.grantType]]: { decrement: reclaimAmount },
        },
      });

      await tx.points_records.create({
        data: {
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
        },
      });
    }

    return {
      pointsReclaimed,
      skippedConsumedPoints,
      skippedFrozenPoints,
      skippedExpiredPoints,
    };
  }

  private optionalDecimal(value?: Prisma.Decimal | number | string | null) {
    if (value === undefined || value === null || value === '') return undefined;
    return new Prisma.Decimal(value);
  }

  private mergeJsonObjects(
    value: unknown,
    extra: Record<string, unknown>,
  ): Prisma.InputJsonValue {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return this.toJsonInput({ ...(value as Record<string, unknown>), ...extra })!;
    }
    return this.toJsonInput(extra)!;
  }

  private toJsonInput(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined || value === null) return undefined;
    return value as Prisma.InputJsonValue;
  }
}
