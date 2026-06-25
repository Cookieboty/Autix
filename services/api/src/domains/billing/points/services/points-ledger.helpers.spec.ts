import { BadRequestException } from '@nestjs/common';
import {
  PointGrantType,
  PointLedgerEventType,
  PointsSource,
} from '../../../platform/prisma/generated';
import {
  assertPositiveAmount,
  buildConsumeRecordData,
  buildEarnRecordData,
  buildExpirationBalanceUpdateData,
  buildExpirationRecordData,
  buildGrantCreateData,
  eventToLegacySource,
  grantTypeForSource,
  ledgerEventForSource,
} from './points-ledger.helpers';

describe('points ledger helpers', () => {
  it('maps legacy sources to grant types and ledger events with existing fallbacks', () => {
    expect(grantTypeForSource(PointsSource.MEMBERSHIP)).toBe(
      PointGrantType.SUBSCRIPTION,
    );
    expect(grantTypeForSource(PointsSource.PACKAGE)).toBe(PointGrantType.PURCHASED);
    expect(grantTypeForSource(PointsSource.TASK)).toBe(PointGrantType.COMPENSATION);
    expect(ledgerEventForSource(PointsSource.CAMPAIGN)).toBe(
      PointLedgerEventType.campaign_bonus,
    );
    expect(ledgerEventForSource(PointsSource.TASK)).toBe(
      PointLedgerEventType.admin_adjustment,
    );
    expect(eventToLegacySource(PointLedgerEventType.points_purchase)).toBe(
      PointsSource.PACKAGE,
    );
    expect(eventToLegacySource(PointLedgerEventType.expiration)).toBe(
      PointsSource.EXPIRATION,
    );
  });

  it('builds grant and earn record payloads with sourceId and remark fallbacks', () => {
    const expiresAt = new Date('2026-07-01T00:00:00.000Z');
    const grantInput = {
      amount: 50,
      grantType: PointGrantType.GIFT,
      sourceEvent: PointLedgerEventType.campaign_bonus,
      expiresAt,
      usageScope: { allowedTaskTypes: ['chat'] },
      metadata: { campaign: 'summer' },
    };

    expect(buildGrantCreateData('u1', grantInput)).toEqual({
      userId: 'u1',
      grantType: PointGrantType.GIFT,
      sourceEvent: PointLedgerEventType.campaign_bonus,
      sourceId: undefined,
      totalAmount: 50,
      availableAmount: 50,
      expiresAt,
      usageScope: { allowedTaskTypes: ['chat'] },
      metadata: { campaign: 'summer' },
    });
    expect(
      buildEarnRecordData({
        userId: 'u1',
        grantInput,
        source: PointsSource.CAMPAIGN,
        grantId: 'grant-1',
        balance: 150,
      }),
    ).toEqual({
      userId: 'u1',
      type: 'EARN',
      amount: 50,
      source: PointsSource.CAMPAIGN,
      sourceId: 'grant-1',
      balance: 150,
      remark: PointLedgerEventType.campaign_bonus,
    });
  });

  it('builds consume and expiration payloads without changing record semantics', () => {
    expect(
      buildConsumeRecordData({
        userId: 'u1',
        amount: 20,
        source: PointsSource.TASK,
        sourceId: 'task-1',
        balance: 80,
        remark: 'generation',
      }),
    ).toEqual({
      userId: 'u1',
      type: 'CONSUME',
      amount: 20,
      source: PointsSource.TASK,
      sourceId: 'task-1',
      balance: 80,
      remark: 'generation',
    });
    expect(
      buildExpirationBalanceUpdateData({
        availableAmount: 30,
        grantType: PointGrantType.SUBSCRIPTION,
      }),
    ).toEqual({
      balance: { decrement: 30 },
      availableBalance: { decrement: 30 },
      totalBalance: { decrement: 30 },
      subscriptionBalance: { decrement: 30 },
    });
    // FIX-19: an explicit clamped amount overrides the grant's availableAmount, so the
    // aggregate balance cannot be decremented below what the user actually holds.
    expect(
      buildExpirationBalanceUpdateData(
        { availableAmount: 30, grantType: PointGrantType.SUBSCRIPTION },
        10,
      ),
    ).toEqual({
      balance: { decrement: 10 },
      availableBalance: { decrement: 10 },
      totalBalance: { decrement: 10 },
      subscriptionBalance: { decrement: 10 },
    });
    expect(
      buildExpirationRecordData({
        grant: { id: 'grant-1', userId: 'u1', availableAmount: 30 },
        balance: 70,
      }),
    ).toEqual({
      userId: 'u1',
      type: 'CONSUME',
      amount: 30,
      source: PointsSource.EXPIRATION,
      sourceId: 'grant-1',
      balance: 70,
      remark: PointLedgerEventType.expiration,
    });
  });

  it('keeps positive integer validation semantics', () => {
    expect(() => assertPositiveAmount(1)).not.toThrow();
    expect(() => assertPositiveAmount(0)).toThrow(BadRequestException);
    expect(() => assertPositiveAmount(1.5)).toThrow(BadRequestException);
  });
});
