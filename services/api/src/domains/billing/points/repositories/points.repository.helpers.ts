import {
  PointGrantType,
  type Prisma,
  type point_hold_items,
} from '../../../platform/prisma/generated';
import { GRANT_TYPE_BALANCE_FIELD } from '../points-grants.helpers';

export function buildGrantBalanceCreateData(
  userId: string,
  amount: number,
  grantTypeField: keyof Prisma.user_pointsUpdateInput,
): Prisma.user_pointsUncheckedCreateInput {
  return {
    userId,
    balance: amount,
    availableBalance: amount,
    totalBalance: amount,
    [grantTypeField]: amount,
  } as Prisma.user_pointsUncheckedCreateInput;
}

export function buildGrantBalanceUpdateData(
  amount: number,
  grantTypeField: keyof Prisma.user_pointsUpdateInput,
): Prisma.user_pointsUpdateInput {
  return {
    balance: { increment: amount },
    availableBalance: { increment: amount },
    totalBalance: { increment: amount },
    [grantTypeField]: { increment: amount },
  } as Prisma.user_pointsUpdateInput;
}

export function buildConfirmHeldGrantItemData(
  item: Pick<point_hold_items, 'amount'>,
  consumeAmount: number,
  refundAmount: number,
): Prisma.point_grantsUpdateManyMutationInput {
  const data: Prisma.point_grantsUpdateManyMutationInput = {
    frozenAmount: { decrement: item.amount },
    consumedAmount: { increment: consumeAmount },
  };
  if (refundAmount > 0) {
    data.availableAmount = { increment: refundAmount };
  }
  return data;
}

export function buildConfirmHeldBalanceMutation(input: {
  userId: string;
  estimatedAmount: number;
  confirmedAmount: number;
  refundAmount: number;
  consumedByType: ReadonlyMap<PointGrantType, number>;
}): {
  where: Prisma.user_pointsWhereInput;
  data: Prisma.user_pointsUpdateInput;
} {
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

  return { where, data };
}

export function buildConsumeBalanceMutation(input: {
  userId: string;
  amount: number;
  consumedByType: ReadonlyMap<PointGrantType, number>;
}): {
  where: Prisma.user_pointsWhereInput;
  data: Prisma.user_pointsUpdateInput;
} {
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

  return { where, data };
}
