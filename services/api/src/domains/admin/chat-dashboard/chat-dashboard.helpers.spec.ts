import { describe, expect, it } from 'vitest';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';
import {
  addLocalDays,
  assertValidIana,
  daysBetweenLocal,
  deltaPct,
  localDateString,
  localMidnightToUtc,
  mergeCurrencyDelta,
  resolveRange,
  riskSeverityBucket,
  successRateDeltaPoints,
} from './chat-dashboard.helpers';

function expectI18nKey(run: () => unknown, key: string) {
  try {
    run();
    throw new Error('expected exception');
  } catch (error) {
    expect(error).toBeInstanceOf(I18nHttpException);
    expect((error as I18nHttpException).i18nKey).toBe(key);
  }
}

describe('chat dashboard range helpers', () => {
  it('resolves preset ranges by local calendar day', () => {
    const now = new Date('2026-07-29T12:00:00.000Z');
    const today = resolveRange({ tz: 'Asia/Shanghai', window: 'today' }, now);
    expect(today.from.toISOString()).toBe('2026-07-28T16:00:00.000Z');
    expect(today.to.toISOString()).toBe('2026-07-29T16:00:00.000Z');
    expect(today.isComplete).toBe(false);
    const last7d = resolveRange({ tz: 'UTC', window: 'last7d' }, now);
    expect(last7d.from.toISOString()).toBe('2026-07-23T00:00:00.000Z');
    expect(last7d.to.toISOString()).toBe('2026-07-30T00:00:00.000Z');
  });

  it('handles 23-hour and 25-hour Los Angeles days without fixed 24h boundaries', () => {
    const springFrom = localMidnightToUtc('America/Los_Angeles', '2026-03-08');
    const springTo = localMidnightToUtc('America/Los_Angeles', '2026-03-09');
    expect(springTo.getTime() - springFrom.getTime()).toBe(23 * 60 * 60 * 1000);
    const fallFrom = localMidnightToUtc('America/Los_Angeles', '2026-11-01');
    const fallTo = localMidnightToUtc('America/Los_Angeles', '2026-11-02');
    expect(fallTo.getTime() - fallFrom.getTime()).toBe(25 * 60 * 60 * 1000);
  });

  it('round-trips real local dates in representative IANA zones', () => {
    for (const tz of ['Asia/Shanghai', 'Europe/Berlin', 'America/Los_Angeles']) {
      for (const localDate of ['2026-01-15', '2026-07-29', '2026-11-01']) {
        expect(localDateString(tz, localMidnightToUtc(tz, localDate))).toBe(localDate);
      }
    }
  });

  it('resolves zones whose DST transition skips local midnight', () => {
    const santiago = localMidnightToUtc('America/Santiago', '2026-09-06');
    const havana = localMidnightToUtc('America/Havana', '2026-03-08');
    expect(santiago.toISOString()).toBe('2026-09-06T04:00:00.000Z');
    expect(havana.toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Santiago',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(santiago)).toBe('01');
    expect(new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Havana',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(havana)).toBe('01');
  });

  it('accepts single-day and 92-day custom ranges but rejects invalid business ranges', () => {
    const now = new Date('2026-07-29T12:00:00.000Z');
    expect(resolveRange({ tz: 'UTC', window: 'custom', from: '2026-07-29', to: '2026-07-29' }, now).fromDate).toBe('2026-07-29');
    expect(() => resolveRange({ tz: 'UTC', window: 'custom', from: '2026-07-23', to: '2026-07-29' }, now)).not.toThrow();
    expect(daysBetweenLocal('2026-04-29', '2026-07-29') + 1).toBe(92);
    expect(() => resolveRange({ tz: 'UTC', window: 'custom', from: '2026-04-29', to: '2026-07-29' }, now)).not.toThrow();
    expect(() => resolveRange({ tz: 'UTC', window: 'custom', from: '2025-06-24', to: '2025-06-24' }, now)).not.toThrow();
    for (const query of [
      { tz: 'UTC', window: 'custom', from: '2026-04-28', to: '2026-07-29' },
      { tz: 'UTC', window: 'custom', from: '2026-07-20', to: '2026-07-19' },
      { tz: 'UTC', window: 'custom', from: '2026-07-30', to: '2026-07-30' },
      { tz: 'UTC', window: 'custom', from: '2025-06-23', to: '2025-06-23' },
      { tz: 'UTC', window: 'custom', from: '2026-02-30', to: '2026-03-01' },
    ] as const) {
      expectI18nKey(() => resolveRange(query, now), 'admin.chat_dashboard.invalid_range');
    }
  });

  it('validates IANA zones at runtime', () => {
    expect(() => assertValidIana('Europe/Berlin')).not.toThrow();
    expect(() => assertValidIana('America/Havana')).not.toThrow();
    expectI18nKey(() => assertValidIana('Foo/Bar'), 'admin.chat_dashboard.invalid_timezone');
    expectI18nKey(() => assertValidIana('x'.repeat(65)), 'admin.chat_dashboard.invalid_timezone');
  });

  it('uses Gregorian day arithmetic and normalized delta rules', () => {
    expect(addLocalDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(deltaPct(0, 0)).toBe(0);
    expect(deltaPct(1, 0)).toBeNull();
    expect(deltaPct(0, 10)).toBe(-100);
    expect(successRateDeltaPoints(0.8, 0.75)).toBe(5);
    expect(mergeCurrencyDelta([{ currency: 'USD', amount: '20' }], [{ currency: 'EUR', amount: '5' }, { currency: 'USD', amount: '10' }])).toEqual([
      { currency: 'EUR', deltaPct: -100 },
      { currency: 'USD', deltaPct: 100 },
    ]);
  });

  it('keeps all documented risk severity boundary values in the intended bucket', () => {
    expect([
      0,
      1,
      39,
      40,
      69,
      70,
      99,
      100,
    ].map(riskSeverityBucket)).toEqual(['A', 'B', 'B', 'C', 'C', 'D', 'D', 'E']);
    expect(riskSeverityBucket(-1)).toBeNull();
    expect(riskSeverityBucket(101)).toBeNull();
  });
});
