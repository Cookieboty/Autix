import { BadRequestException } from '@nestjs/common';
import {
  PointGrantType,
  PointLedgerEventType,
  PointsSource,
  type Prisma,
  type point_grants,
  type user_points,
} from '../../../platform/prisma/generated';
import { GRANT_TYPE_BALANCE_FIELD } from '../points-grants.helpers';

export interface GrantPointsInput {
  amount: number;
  grantType: PointGrantType;
  sourceEvent: PointLedgerEventType;
  sourceId?: string;
  expiresAt?: Date | null;
  usageScope?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
  source?: PointsSource;
  remark?: string;
}

const SOURCE_TO_GRANT: Partial<Record<PointsSource, PointGrantType>> = {
  [PointsSource.MEMBERSHIP]: PointGrantType.SUBSCRIPTION,
  [PointsSource.PACKAGE]: PointGrantType.PURCHASED,
  [PointsSource.INVITATION]: PointGrantType.GIFT,
  [PointsSource.CAMPAIGN]: PointGrantType.GIFT,
  [PointsSource.ADMIN_GRANT]: PointGrantType.COMPENSATION,
};

const SOURCE_TO_EVENT: Partial<Record<PointsSource, PointLedgerEventType>> = {
  [PointsSource.MEMBERSHIP]: PointLedgerEventType.subscription_grant,
  [PointsSource.PACKAGE]: PointLedgerEventType.points_purchase,
  [PointsSource.INVITATION]: PointLedgerEventType.campaign_bonus,
  [PointsSource.CAMPAIGN]: PointLedgerEventType.campaign_bonus,
  [PointsSource.ADMIN_GRANT]: PointLedgerEventType.admin_adjustment,
};

export function assertPositiveAmount(amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new BadRequestException('积分数量必须为正整数');
  }
}

export function grantTypeForSource(source: PointsSource): PointGrantType {
  return SOURCE_TO_GRANT[source] ?? PointGrantType.COMPENSATION;
}

export function ledgerEventForSource(source: PointsSource): PointLedgerEventType {
  return SOURCE_TO_EVENT[source] ?? PointLedgerEventType.admin_adjustment;
}

export function eventToLegacySource(event: PointLedgerEventType): PointsSource {
  switch (event) {
    case PointLedgerEventType.subscription_grant:
      return PointsSource.MEMBERSHIP;
    case PointLedgerEventType.points_purchase:
      return PointsSource.PACKAGE;
    case PointLedgerEventType.campaign_bonus:
      return PointsSource.CAMPAIGN;
    case PointLedgerEventType.expiration:
      return PointsSource.EXPIRATION;
    default:
      return PointsSource.ADMIN_GRANT;
  }
}

export function presentAccountSummary(account: user_points, grants: point_grants[]) {
  return {
    account,
    grants,
    balances: {
      available: account.availableBalance,
      frozen: account.frozenBalance,
      total: account.totalBalance,
      subscription: account.subscriptionBalance,
      purchased: account.purchasedBalance,
      gift: account.giftBalance,
      compensation: account.compensationBalance,
    },
  };
}

export function buildGrantCreateData(
  userId: string,
  input: GrantPointsInput,
): Prisma.point_grantsUncheckedCreateInput {
  return {
    userId,
    grantType: input.grantType,
    sourceEvent: input.sourceEvent,
    sourceId: input.sourceId,
    totalAmount: input.amount,
    availableAmount: input.amount,
    expiresAt: input.expiresAt ?? null,
    usageScope: input.usageScope,
    metadata: input.metadata,
  };
}

export function buildEarnRecordData(input: {
  userId: string;
  grantInput: GrantPointsInput;
  source: PointsSource;
  grantId: string;
  balance: number;
}): Prisma.points_recordsUncheckedCreateInput {
  return {
    userId: input.userId,
    type: 'EARN',
    amount: input.grantInput.amount,
    source: input.source,
    sourceId: input.grantInput.sourceId ?? input.grantId,
    balance: input.balance,
    remark: input.grantInput.remark ?? input.grantInput.sourceEvent,
  };
}

export function buildConsumeRecordData(input: {
  userId: string;
  amount: number;
  source: PointsSource;
  sourceId?: string;
  balance: number;
  remark?: string;
}): Prisma.points_recordsUncheckedCreateInput {
  return {
    userId: input.userId,
    type: 'CONSUME',
    amount: input.amount,
    source: input.source,
    sourceId: input.sourceId,
    balance: input.balance,
    remark: input.remark,
  };
}

export function buildExpirationBalanceUpdateData(
  grant: Pick<point_grants, 'availableAmount' | 'grantType'>,
  // FIX-19: 可传入钳制后的安全额度，避免账目漂移时把聚合余额减成负数。
  amount: number = grant.availableAmount,
): Prisma.user_pointsUpdateInput {
  return {
    balance: { decrement: amount },
    availableBalance: { decrement: amount },
    totalBalance: { decrement: amount },
    [GRANT_TYPE_BALANCE_FIELD[grant.grantType]]: {
      decrement: amount,
    },
  } as Prisma.user_pointsUpdateInput;
}

export function buildExpirationRecordData(input: {
  grant: Pick<point_grants, 'id' | 'userId' | 'availableAmount'>;
  balance: number;
}): Prisma.points_recordsUncheckedCreateInput {
  return {
    userId: input.grant.userId,
    type: 'CONSUME',
    amount: input.grant.availableAmount,
    source: PointsSource.EXPIRATION,
    sourceId: input.grant.id,
    balance: input.balance,
    remark: PointLedgerEventType.expiration,
  };
}
