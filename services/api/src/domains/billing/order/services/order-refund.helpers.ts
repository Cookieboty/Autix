import { BadRequestException } from '@nestjs/common';
import { OrderStatus, OrderType, Prisma } from '../../../platform/prisma/generated';
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

export function mergeRefundInput(
  input: RefundOrderInput,
  patch: Partial<RefundOrderInput>,
): RefundOrderInput {
  return {
    ...input,
    ...patch,
    metadata: mergeJsonObjects(input.metadata, {
      ...(patch.metadata && typeof patch.metadata === 'object' && !Array.isArray(patch.metadata)
        ? patch.metadata as Record<string, unknown>
        : { providerPayload: patch.metadata }),
    }),
  };
}

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
    membershipRevoked: false,
    cancelSubscriptionId: undefined as string | undefined,
    pointsReclaimed: 0,
    skippedConsumedPoints: 0,
    skippedFrozenPoints: 0,
  };
}

/**
 * FIX-7/9: 退款金额不得超过已支付金额（避免本地账目记录出现超额退款）。
 * 注：当前策略下"任何退款都撤销会员并将订单置 REFUNDED（终态）"，
 * 因此不支持多次部分退款；`PARTIALLY_REFUNDED` 独立状态留待 P2（需枚举迁移）。
 */
export function assertRefundAmountWithinPaidAmount(
  order: { paidAmount: Prisma.Decimal | null; amount: Prisma.Decimal },
  input: RefundOrderInput = {},
): void {
  const paid = Number(order.paidAmount ?? order.amount);
  if (!Number.isFinite(paid)) return;
  const requested =
    input.amount === undefined || input.amount === null || input.amount === ''
      ? paid
      : Number(input.amount);
  if (Number.isFinite(requested) && requested > paid + 0.000001) {
    throw new BadRequestException('Refund amount cannot exceed the paid amount');
  }
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

type RefundMembershipOrder = {
  orderType: OrderType;
  productId: string;
};

type RefundMembershipState = {
  status: string;
  planId: string | null;
  stripeSubscriptionId: string | null;
};

/**
 * FIX-1: 退款时撤销会员权益。
 *
 * 决策：任何退款都撤销与该订单关联的、当前生效的会员权益。
 * 关联判定（避免误伤用户后续升级到的另一笔会员）：
 *   - 订单是会员订单，且会员当前 ACTIVE；并且
 *   - 订单的套餐 productId 与会员当前 planId 一致，或
 *   - 订单的 Stripe 订阅与会员的 stripeSubscriptionId 一致。
 * 若无法判定关联（例如已升级到不同套餐且无订阅匹配），返回 null（不撤销），由调用方记录告警。
 */
export function buildMembershipRevocationForRefund(
  order: RefundMembershipOrder,
  membership: RefundMembershipState | null,
  options: { orderSubscriptionId?: string | null; now?: Date } = {},
): Prisma.user_membershipsUncheckedUpdateInput | null {
  if (order.orderType !== OrderType.MEMBERSHIP) return null;
  if (!membership || membership.status !== 'ACTIVE') return null;

  const matchesPlan = Boolean(membership.planId) && membership.planId === order.productId;
  const matchesSubscription =
    Boolean(options.orderSubscriptionId) &&
    Boolean(membership.stripeSubscriptionId) &&
    membership.stripeSubscriptionId === options.orderSubscriptionId;
  if (!matchesPlan && !matchesSubscription) return null;

  const now = options.now ?? new Date();
  return {
    status: 'EXPIRED',
    expiresAt: now,
    autoRenew: false,
    cancelAtPeriodEnd: false,
    cancelledAt: now,
    pendingPlanId: null,
    pendingOrderId: null,
    pendingLevelId: null,
    pendingBillingCycle: null,
    pendingAutoRenew: null,
    pendingChangeEffectiveAt: null,
    pendingChangeRequestedAt: null,
  };
}

/** 从订单 paymentMetadata（Stripe webhook payload）中提取订阅 ID。 */
export function extractOrderSubscriptionId(metadata: unknown): string | null {
  const object = asObject(asObject(asObject(metadata)?.data)?.object);
  const subscription = object?.subscription;
  return typeof subscription === 'string' && subscription.trim() ? subscription.trim() : null;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function mergeJsonObjects(
  value: unknown,
  extra: Record<string, unknown>,
): Prisma.InputJsonValue {
  const base = asObject(value);
  return toJsonInput(base ? { ...base, ...extra } : extra)!;
}

function resolveManualRefundPresentation(order: RefundableOrder, input: RefundOrderInput = {}) {
  return {
    provider: input.provider ?? 'admin_manual',
    externalRefundId: input.externalRefundId ?? `manual-refund:${order.id}`,
    amount: optionalDecimal(input.amount) ?? order.paidAmount ?? order.amount,
    currency: order.currency ?? input.currency ?? DEFAULT_PAYMENT_CURRENCY,
  };
}
