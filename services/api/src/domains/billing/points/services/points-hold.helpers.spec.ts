import { BadRequestException } from '@nestjs/common';
import {
  PointGrantType,
  PointHoldStatus,
  PointLedgerEventType,
  PointsSource,
} from '../../../platform/prisma/generated';
import {
  assertConfirmAmount,
  buildConfirmRecordUpdateData,
  buildHoldConfirmationPlan,
  buildHoldCreateData,
  buildHoldItemCreateData,
  buildPendingHoldRecordData,
  buildRefundRecordUpdateData,
  isConfirmTerminalStatus,
  isRefundTerminalStatus,
  presentConfirmedHoldStatus,
  sumHoldItemAmount,
  type CreateHoldInput,
} from './points-hold.helpers';

const createInput: CreateHoldInput = {
  taskType: 'video_generation',
  taskId: 'video-1',
  amount: 100,
};

describe('points hold helpers', () => {
  it('builds hold, item, and pending record payloads without changing defaults', () => {
    expect(buildHoldCreateData('u1', createInput)).toEqual({
      userId: 'u1',
      taskType: 'video_generation',
      taskId: 'video-1',
      estimatedAmount: 100,
      status: PointHoldStatus.PENDING,
      pricingSnapshot: undefined,
      refundPolicySnapshot: undefined,
      metadata: undefined,
    });
    expect(
      buildHoldItemCreateData('hold-1', {
        grant: {
          id: 'grant-1',
          grantType: PointGrantType.GIFT,
          availableAmount: 100,
          frozenAmount: 0,
          expiresAt: null,
          usageScope: null,
        },
        amount: 60,
      }),
    ).toEqual({
      holdId: 'hold-1',
      grantId: 'grant-1',
      amount: 60,
      grantType: PointGrantType.GIFT,
      expiresAt: null,
    });
    expect(
      buildPendingHoldRecordData({
        userId: 'u1',
        holdId: 'hold-1',
        createInput,
        balance: 200,
      }),
    ).toEqual({
      userId: 'u1',
      type: 'CONSUME',
      amount: 100,
      source: PointsSource.TASK,
      sourceId: 'video-1',
      balance: 200,
      status: 'PENDING',
      holdId: 'hold-1',
      remark: 'generation_freeze:video_generation',
    });
  });

  it('plans confirmation by hold item order and aggregates consumed grant types', () => {
    const plan = buildHoldConfirmationPlan({
      estimatedAmount: 100,
      actualAmount: 80,
      items: [
        { grantId: 'gift-1', grantType: PointGrantType.GIFT, amount: 40 },
        { grantId: 'gift-2', grantType: PointGrantType.GIFT, amount: 30 },
        { grantId: 'sub-1', grantType: PointGrantType.SUBSCRIPTION, amount: 30 },
      ],
    });

    expect(plan.confirmedAmount).toBe(80);
    expect(plan.refundAmount).toBe(20);
    expect(plan.itemConsumptions.map((item) => item.consumeAmount)).toEqual([
      40,
      30,
      10,
    ]);
    expect(plan.itemConsumptions.map((item) => item.refundAmount)).toEqual([
      0,
      0,
      20,
    ]);
    expect(Array.from(plan.consumedByType.entries())).toEqual([
      [PointGrantType.GIFT, 70],
      [PointGrantType.SUBSCRIPTION, 10],
    ]);
  });

  it('keeps confirmation validation and over-confirm errors in helpers', () => {
    expect(() => assertConfirmAmount(-1)).toThrow(BadRequestException);
    expect(() =>
      buildHoldConfirmationPlan({
        estimatedAmount: 100,
        actualAmount: 101,
        items: [],
      }),
    ).toThrow(BadRequestException);
  });

  it('presents terminal status and confirmed record semantics', () => {
    expect(isConfirmTerminalStatus(PointHoldStatus.CONFIRMED)).toBe(true);
    expect(isConfirmTerminalStatus(PointHoldStatus.PARTIALLY_REFUNDED)).toBe(true);
    expect(isConfirmTerminalStatus(PointHoldStatus.PENDING)).toBe(false);
    expect(isRefundTerminalStatus(PointHoldStatus.REFUNDED)).toBe(true);

    expect(presentConfirmedHoldStatus(0, 100)).toBe(PointHoldStatus.REFUNDED);
    expect(presentConfirmedHoldStatus(80, 20)).toBe(
      PointHoldStatus.PARTIALLY_REFUNDED,
    );
    expect(presentConfirmedHoldStatus(100, 0)).toBe(PointHoldStatus.CONFIRMED);
    expect(
      buildConfirmRecordUpdateData({
        status: PointHoldStatus.PARTIALLY_REFUNDED,
        confirmedAmount: 80,
        balance: 20,
      }),
    ).toEqual({
      status: 'CONFIRMED',
      amount: 80,
      balance: 20,
      remark: PointLedgerEventType.generation_cost,
    });
    expect(
      buildConfirmRecordUpdateData({
        status: PointHoldStatus.REFUNDED,
        confirmedAmount: 0,
        balance: 100,
      }),
    ).toEqual({
      status: 'REFUNDED',
      amount: 0,
      balance: 100,
      remark: PointLedgerEventType.generation_refund,
    });
  });

  it('builds refund presenter data from held items and reason', () => {
    expect(
      sumHoldItemAmount([
        { grantId: 'gift', grantType: PointGrantType.GIFT, amount: 40 },
        { grantId: 'sub', grantType: PointGrantType.SUBSCRIPTION, amount: 60 },
      ]),
    ).toBe(100);
    expect(
      buildRefundRecordUpdateData({ balance: 100, reason: 'provider failed' }),
    ).toEqual({
      status: 'REFUNDED',
      balance: 100,
      remark: 'refund: provider failed',
    });
  });
});
