import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma/prisma.service';
import { OrderRepository } from '../repositories/order.repository';
import { PaymentEventRepository } from '../repositories/payment-event.repository';
import { OrderPointReclaimService } from './order-point-reclaim.service';
import {
  OrderStatus,
  Prisma,
} from '../../../platform/prisma/generated';

const DEFAULT_PAYMENT_CURRENCY = 'USD';

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
    private readonly pointReclaimService: OrderPointReclaimService,
  ) {}

  async refundOrder(id: string, input: RefundOrderInput = {}) {
    return this.prisma.$transaction(async (tx) => {
      const order = await this.orderRepo.findByIdWithinTxOrThrow(tx, id);
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

      const pointRecovery = await this.pointReclaimService.reclaimAvailableOrderPointsWithinTx(
        tx,
        order,
        input.reason ?? 'order refund',
        {
          reclaimPoints: input.reclaimPoints,
          maxPointsToReclaim: input.maxPointsToReclaim,
        },
      );

      await this.orderRepo.clearPendingMembershipChangeForOrderWithinTx(tx, order);

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

      const refundedOrder = await this.orderRepo.updateWithinTx(tx, id, {
        status: OrderStatus.REFUNDED,
        refundProvider,
        externalRefundId,
        refundAmount: this.optionalDecimal(input.amount) ?? order.paidAmount ?? order.amount,
        refundReason: input.reason ?? 'order refund',
        refundMetadata,
        refundedAt: new Date(),
      });

      return {
        order: refundedOrder,
        alreadyRefunded: false,
        ...pointRecovery,
      };
    });
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
