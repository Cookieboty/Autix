import { BadRequestException } from '@nestjs/common';
import {
  BillingCycle,
  OrderStatus,
  PointGrantType,
  PointLedgerEventType,
  PointsSource,
  Prisma,
} from '../../../platform/prisma/generated';
import { addDays, addMonths, minDate } from '../../../platform/common/date-utils';

export const FREE_TRIAL_GRANT_DAYS = 30;
export const DEFAULT_PAYMENT_CURRENCY = 'USD';

export type PaymentDetails = {
  provider?: string;
  eventId?: string;
  externalPaymentId?: string;
  amount?: Prisma.Decimal | number | string | null;
  currency?: string;
  metadata?: unknown;
};

export type PaymentWebhookInput = {
  provider: string;
  eventId: string;
  eventType: string;
  status?: string;
  orderId?: string;
  orderNo?: string;
  externalPaymentId?: string;
  amount?: Prisma.Decimal | number | string | null;
  currency?: string;
  payload?: unknown;
};

type ManualPaymentInput = PaymentDetails & {
  operatorId?: string;
  remark?: string;
};

type MembershipGrantInput = {
  order: {
    id: string;
    businessType: string | null;
  };
  membershipId: string;
  plan: {
    id: string;
    billingCycle: BillingCycle;
    price: Prisma.Decimal | number | string;
    level: { level: number; name: string };
  };
  now: Date;
  nextExpiresAt: Date;
  activeMembership?: { startedAt: Date; expiresAt: Date } | null;
  isUpgrade: boolean;
  previousPoints: number;
  pointsToGrant: number;
};

type PointsPackageGrantInput = {
  orderId: string;
  packageId: string;
  packageCode: string | null;
  packageName: string | null;
  packagePoints: number;
  validityDays: number;
  usageScope?: Prisma.JsonValue | null;
  now: Date;
};

export function currentSubscriptionCycleEnd(
  startedAt: Date,
  membershipExpiresAt: Date,
  now: Date,
) {
  for (let index = 0; index <= 120; index++) {
    const cycleStart = addMonths(startedAt, index);
    const cycleEnd = minDate(addMonths(startedAt, index + 1), membershipExpiresAt);
    if (cycleStart <= now && cycleEnd > now) return cycleEnd;
  }
  return minDate(addMonths(now, 1), membershipExpiresAt);
}

export function isPaidPaymentEvent(input: Pick<PaymentWebhookInput, 'eventType' | 'status'>) {
  const normalizedStatus = input.status?.toLowerCase();
  const normalizedType = input.eventType.toLowerCase();
  if (
    normalizedType.includes('refund') ||
    normalizedType.includes('cancel') ||
    normalizedType.includes('fail') ||
    normalizedType.includes('void') ||
    normalizedStatus === 'refunded' ||
    normalizedStatus === 'cancelled' ||
    normalizedStatus === 'canceled' ||
    normalizedStatus === 'failed'
  ) {
    return false;
  }
  return (
    normalizedStatus === 'paid' ||
    normalizedStatus === 'succeeded' ||
    normalizedStatus === 'success' ||
    normalizedType.includes('paid') ||
    normalizedType.includes('succeeded') ||
    normalizedType.includes('success')
  );
}

export function shouldUpdatePaidOrderPayment(
  order: { status: OrderStatus },
  payment?: PaymentDetails,
) {
  return order.status !== OrderStatus.PAID || hasPaymentUpdateDetails(payment);
}

export function assertPaymentAmountMatchesOrder(
  order: { amount: Prisma.Decimal | number | string },
  amount?: Prisma.Decimal | number | string | null,
  options: { requireAmount?: boolean; allowLessThanExpected?: boolean } = {},
) {
  const expected = Number(order.amount);
  if (amount === undefined || amount === null || amount === '') {
    if (options.requireAmount && expected > 0) {
      throw new BadRequestException('支付金额缺失');
    }
    return;
  }
  const actual = Number(amount);
  if (!Number.isFinite(actual) || actual <= 0) {
    if (expected === 0 && actual === 0) return;
    throw new BadRequestException('支付金额无效');
  }
  if (options.allowLessThanExpected && actual > 0 && actual <= expected) {
    return;
  }
  if (Math.abs(actual - expected) > 0.000001) {
    throw new BadRequestException('支付金额与订单金额不一致');
  }
}

export function assertPaymentCurrencyMatchesOrder(
  order: { currency: string | null },
  currency?: string | null,
  options: { requireCurrency?: boolean } = {},
) {
  const expected = (order.currency ?? DEFAULT_PAYMENT_CURRENCY).toUpperCase();
  if (!currency) {
    if (options.requireCurrency) {
      throw new BadRequestException('支付币种缺失');
    }
    return;
  }
  const actual = currency.toUpperCase();
  if (actual !== expected) {
    throw new BadRequestException('支付币种与订单币种不一致');
  }
}

export function isActivePaidMembership(
  membership:
    | { status: string; expiresAt: Date; level?: { level: number } | null }
    | null
    | undefined,
  now: Date,
) {
  return (
    !!membership &&
    membership.status === 'ACTIVE' &&
    membership.expiresAt > now &&
    Number(membership.level?.level ?? 0) > 0
  );
}

export function buildManualPaymentWebhookInput(
  id: string,
  input: ManualPaymentInput = {},
): PaymentWebhookInput {
  const eventId = input.eventId ?? `manual-paid:${id}`;
  const provider = input.provider ?? 'admin_manual';
  return {
    provider,
    eventId,
    eventType: 'manual.payment.succeeded',
    status: 'succeeded',
    orderId: id,
    externalPaymentId: input.externalPaymentId ?? eventId,
    amount: input.amount,
    currency: input.currency ?? DEFAULT_PAYMENT_CURRENCY,
    payload: buildManualPaymentPayload(input),
  };
}

export function buildPaidOrderUpdate(
  order: {
    paymentProvider: string | null;
    paymentEventId: string | null;
    externalPaymentId: string | null;
    paidAmount: Prisma.Decimal | null;
    amount: Prisma.Decimal;
    currency: string | null;
    paidAt: Date | null;
  },
  payment?: PaymentDetails,
): Prisma.ordersUpdateInput {
  return {
    status: OrderStatus.PAID,
    paidAt: order.paidAt ?? new Date(),
    paymentProvider: payment?.provider ?? order.paymentProvider,
    paymentEventId: payment?.eventId ?? order.paymentEventId,
    externalPaymentId: payment?.externalPaymentId ?? order.externalPaymentId,
    paidAmount: optionalDecimal(payment?.amount) ?? order.paidAmount ?? order.amount,
    currency: payment?.currency ?? order.currency ?? DEFAULT_PAYMENT_CURRENCY,
    paymentMetadata: toJsonInput(payment?.metadata),
  };
}

export function buildMembershipGrantInput(input: MembershipGrantInput) {
  const isFreePlan = input.plan.level.level === 0 || Number(input.plan.price) === 0;
  return {
    amount: input.pointsToGrant,
    grantType: isFreePlan ? PointGrantType.GIFT : PointGrantType.SUBSCRIPTION,
    sourceEvent: isFreePlan
      ? PointLedgerEventType.campaign_bonus
      : PointLedgerEventType.subscription_grant,
    source: PointsSource.MEMBERSHIP,
    sourceId: input.order.id,
    expiresAt: isFreePlan
      ? addDays(input.now, FREE_TRIAL_GRANT_DAYS)
      : input.isUpgrade && input.activeMembership
        ? currentSubscriptionCycleEnd(
            input.activeMembership.startedAt,
            input.activeMembership.expiresAt,
            input.now,
          )
        : minDate(addMonths(input.now, 1), input.nextExpiresAt),
    usageScope: isFreePlan
      ? { excludedTaskTypes: ['seedance_720p', 'seedance_1080p', 'seedance_fast_720p'] }
      : undefined,
    metadata: {
      orderId: input.order.id,
      membershipId: input.membershipId,
      planId: input.plan.id,
      billingCycle: input.plan.billingCycle,
      monthlyGrant: true,
      pointsOnlyForCurrentCycle: input.plan.billingCycle === BillingCycle.YEARLY,
      businessType: input.order.businessType,
      upgradeGrant: input.isUpgrade,
      previousPoints: input.previousPoints,
    },
    remark: isFreePlan
      ? `Free 一次性体验积分: ${input.plan.level.name}`
      : `会员订阅积分: ${input.plan.level.name}`,
  };
}

export function buildPointsPackageGrantInput(input: PointsPackageGrantInput) {
  return {
    amount: input.packagePoints,
    grantType: PointGrantType.PURCHASED,
    sourceEvent: PointLedgerEventType.points_purchase,
    source: PointsSource.PACKAGE,
    sourceId: input.orderId,
    expiresAt: addDays(input.now, input.validityDays),
    usageScope: (input.usageScope ?? undefined) as Prisma.InputJsonValue | undefined,
    metadata: {
      orderId: input.orderId,
      packageId: input.packageId,
      packageCode: input.packageCode,
      validityDays: input.validityDays,
    },
    remark: `积分包购买: ${input.packageName}`,
  };
}

export function optionalDecimal(value?: Prisma.Decimal | number | string | null) {
  if (value === undefined || value === null || value === '') return undefined;
  return new Prisma.Decimal(value);
}

export function toJsonInput(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return value as Prisma.InputJsonValue;
}

function hasPaymentUpdateDetails(payment?: PaymentDetails) {
  return Boolean(
    payment &&
      (payment.provider ||
        payment.eventId ||
        payment.externalPaymentId ||
        payment.amount ||
        payment.currency ||
        payment.metadata),
  );
}

function buildManualPaymentPayload(input: ManualPaymentInput): Prisma.InputJsonValue {
  return {
    operatorId: input.operatorId,
    remark: input.remark,
    metadata: input.metadata,
  } as Prisma.InputJsonValue;
}
