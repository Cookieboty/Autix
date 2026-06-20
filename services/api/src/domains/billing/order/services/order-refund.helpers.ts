import { OrderStatus, Prisma } from '../../../platform/prisma/generated';
import { DEFAULT_PAYMENT_CURRENCY, optionalDecimal, toJsonInput } from './order-fulfillment.helpers';

export type RefundOrderInput = {
  provider?: string;
  externalRefundId?: string;
  amount?: Prisma.Decimal | number | string | null;
  currency?: string;
  reclaimPoints?: boolean;
  maxPointsToReclaim?: number;
  reason?: string;
  metadata?: unknown;
};

type RefundPointRecovery = {
  pointsReclaimed: number;
  skippedConsumedPoints: number;
  skippedFrozenPoints: number;
};

type RefundableOrder = {
  id: string;
  userId: string;
  orderNo: string;
  status: OrderStatus;
  externalPaymentId: string | null;
  paidAmount: Prisma.Decimal | null;
  amount: Prisma.Decimal;
  currency: string | null;
};

export function buildAlreadyRefundedResult(order: RefundableOrder) {
  return {
    order,
    alreadyRefunded: true,
    pointsReclaimed: 0,
    skippedConsumedPoints: 0,
    skippedFrozenPoints: 0,
  };
}

export function buildRefundPaymentEventInput(order: RefundableOrder, input: RefundOrderInput = {}) {
  const refund = resolveManualRefundPresentation(order, input);
  return {
    provider: refund.provider,
    externalRefundId: refund.externalRefundId,
    orderId: order.id,
    userId: order.userId,
    orderNo: order.orderNo,
    externalPaymentId: order.externalPaymentId,
    amount: refund.amount,
    currency: refund.currency,
    metadata: input.metadata,
  };
}

export function buildRefundOrderUpdate(
  order: RefundableOrder,
  pointRecovery: RefundPointRecovery,
  input: RefundOrderInput = {},
): Prisma.ordersUpdateInput {
  const refund = resolveManualRefundPresentation(order, input);
  return {
    status: OrderStatus.REFUNDED,
    refundProvider: refund.provider,
    externalRefundId: refund.externalRefundId,
    refundAmount: refund.amount,
    refundReason: input.reason ?? 'order refund',
    refundMetadata: mergeJsonObjects(input.metadata, {
      pointsReclaimed: pointRecovery.pointsReclaimed,
      skippedConsumedPoints: pointRecovery.skippedConsumedPoints,
      skippedFrozenPoints: pointRecovery.skippedFrozenPoints,
    }),
    refundedAt: new Date(),
  };
}

export function mergeJsonObjects(
  value: unknown,
  extra: Record<string, unknown>,
): Prisma.InputJsonValue {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return toJsonInput({ ...(value as Record<string, unknown>), ...extra })!;
  }
  return toJsonInput(extra)!;
}

function resolveManualRefundPresentation(order: RefundableOrder, input: RefundOrderInput = {}) {
  return {
    provider: input.provider ?? 'admin_manual',
    externalRefundId: input.externalRefundId ?? `manual-refund:${order.id}`,
    amount: optionalDecimal(input.amount) ?? order.paidAmount ?? order.amount,
    currency: order.currency ?? input.currency ?? DEFAULT_PAYMENT_CURRENCY,
  };
}
