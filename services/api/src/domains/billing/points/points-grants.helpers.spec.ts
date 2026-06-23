import { BadRequestException } from '@nestjs/common';
import { PointGrantType } from '../../platform/prisma/generated';
import {
  grantCanBeUsedForTask,
  selectGrantsForAmount,
  type PointGrantRecord,
} from './points-grants.helpers';

function grant(overrides: Partial<PointGrantRecord>): PointGrantRecord {
  return {
    id: 'grant',
    grantType: PointGrantType.PURCHASED,
    availableAmount: 100,
    frozenAmount: 0,
    expiresAt: null,
    usageScope: null,
    ...overrides,
  };
}

describe('points grant helpers', () => {
  it('selects grants by expiry first and grant type priority for same expiry', () => {
    const sameExpiry = new Date('2026-07-01T00:00:00.000Z');
    const selected = selectGrantsForAmount(
      [
        grant({
          id: 'same-sub',
          grantType: PointGrantType.SUBSCRIPTION,
          availableAmount: 80,
          expiresAt: sameExpiry,
        }),
        grant({
          id: 'no-expiry-gift',
          grantType: PointGrantType.GIFT,
          availableAmount: 100,
          expiresAt: null,
        }),
        grant({
          id: 'same-gift',
          grantType: PointGrantType.GIFT,
          availableAmount: 30,
          expiresAt: sameExpiry,
        }),
        grant({
          id: 'earlier-purchased',
          grantType: PointGrantType.PURCHASED,
          availableAmount: 20,
          expiresAt: new Date('2026-06-01T00:00:00.000Z'),
        }),
      ],
      90,
    );

    expect(selected.map((item) => [item.grant.id, item.amount])).toEqual([
      ['earlier-purchased', 20],
      ['same-gift', 30],
      ['same-sub', 40],
    ]);
  });

  it('throws the existing insufficient balance error when selected grants fall short', () => {
    expect(() =>
      selectGrantsForAmount(
        [grant({ id: 'gift', grantType: PointGrantType.GIFT, availableAmount: 10 })],
        11,
      ),
    ).toThrow(BadRequestException);
  });

  it('matches usage scope by exact task and prefix allow/deny lists', () => {
    expect(grantCanBeUsedForTask(grant({ usageScope: null }), 'video_generation')).toBe(true);
    expect(
      grantCanBeUsedForTask(
        grant({ usageScope: { allowedTaskTypes: ['image_generation'] } }),
        'video_generation',
      ),
    ).toBe(false);
    expect(
      grantCanBeUsedForTask(
        grant({ usageScope: { excludedTaskTypes: ['skill_acquisition'] } }),
        'skill_acquisition',
      ),
    ).toBe(false);
    expect(
      grantCanBeUsedForTask(
        grant({ usageScope: { allowedTaskPrefixes: ['legacy_video_'] } }),
        'legacy_video_render',
      ),
    ).toBe(true);
    expect(
      grantCanBeUsedForTask(
        grant({ usageScope: { excludedTaskPrefixes: ['legacy_video_'] } }),
        'legacy_video_render',
      ),
    ).toBe(false);
  });
});
