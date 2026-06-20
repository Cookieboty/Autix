import { PointGrantType } from '../../../platform/prisma/generated';
import {
  buildConfirmHeldBalanceMutation,
  buildConfirmHeldGrantItemData,
  buildConsumeBalanceMutation,
  buildGrantBalanceCreateData,
  buildGrantBalanceUpdateData,
} from './points.repository.helpers';

describe('points repository helpers', () => {
  it('builds grant balance upsert data with the matching split balance field', () => {
    expect(buildGrantBalanceCreateData('u1', 100, 'purchasedBalance')).toEqual({
      userId: 'u1',
      balance: 100,
      availableBalance: 100,
      totalBalance: 100,
      purchasedBalance: 100,
    });
    expect(buildGrantBalanceUpdateData(100, 'purchasedBalance')).toEqual({
      balance: { increment: 100 },
      availableBalance: { increment: 100 },
      totalBalance: { increment: 100 },
      purchasedBalance: { increment: 100 },
    });
  });

  it('builds grant confirmation mutation data and only restores availability on refund', () => {
    expect(
      buildConfirmHeldGrantItemData({ amount: 60 }, 40, 20),
    ).toEqual({
      frozenAmount: { decrement: 60 },
      consumedAmount: { increment: 40 },
      availableAmount: { increment: 20 },
    });
    expect(buildConfirmHeldGrantItemData({ amount: 60 }, 60, 0)).toEqual({
      frozenAmount: { decrement: 60 },
      consumedAmount: { increment: 60 },
    });
  });

  it('builds guarded frozen balance confirmation data with consumed split balances', () => {
    const consumedByType = new Map([
      [PointGrantType.GIFT, 40],
      [PointGrantType.SUBSCRIPTION, 40],
    ]);

    expect(
      buildConfirmHeldBalanceMutation({
        userId: 'u1',
        estimatedAmount: 100,
        confirmedAmount: 80,
        refundAmount: 20,
        consumedByType,
      }),
    ).toEqual({
      where: {
        userId: 'u1',
        frozenBalance: { gte: 100 },
        giftBalance: { gte: 40 },
        subscriptionBalance: { gte: 40 },
      },
      data: {
        frozenBalance: { decrement: 100 },
        availableBalance: { increment: 20 },
        balance: { increment: 20 },
        totalBalance: { decrement: 80 },
        giftBalance: { decrement: 40 },
        subscriptionBalance: { decrement: 40 },
      },
    });
  });

  it('builds guarded consume balance mutation data with consumed split balances', () => {
    const consumedByType = new Map([
      [PointGrantType.GIFT, 20],
      [PointGrantType.PURCHASED, 40],
    ]);

    expect(
      buildConsumeBalanceMutation({
        userId: 'u1',
        amount: 60,
        consumedByType,
      }),
    ).toEqual({
      where: {
        userId: 'u1',
        balance: { gte: 60 },
        availableBalance: { gte: 60 },
        giftBalance: { gte: 20 },
        purchasedBalance: { gte: 40 },
      },
      data: {
        balance: { decrement: 60 },
        availableBalance: { decrement: 60 },
        totalBalance: { decrement: 60 },
        giftBalance: { decrement: 20 },
        purchasedBalance: { decrement: 40 },
      },
    });
  });
});
