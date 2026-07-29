import { describe, expect, it } from 'vitest';
import {
  CHAT_QUICK_ACTIONS,
  PENDING_INBOX_LINKS,
  comparisonState,
  deriveHeaderMetrics,
  formatDeltaPct,
  formatDeltaPoints,
  isValidLocalDate,
  toRangeQuery,
  validateRange,
} from '../chat-dashboard.helpers';

describe('chat dashboard helpers', () => {
  it('does not double-count template image/video details in pendingTotal', () => {
    const result = deriveHeaderMetrics({
      pending: {
        galleryPendingCount: 1,
        galleryPendingReportCount: 2,
        templatePendingCount: 3,
        templatePendingImageCount: 2,
        templatePendingVideoCount: 1,
        registrationPendingCount: 4,
        riskFlaggedUserCount: 5,
        batchJobProcessingCount: 6,
        updatedAt: new Date().toISOString(),
      },
    });
    expect(result.pendingTotal).toBe(21);
  });

  it('validates real calendar dates and custom boundaries', () => {
    const now = new Date('2026-07-29T12:00:00.000Z');
    expect(isValidLocalDate('2026-02-29')).toBe(false);
    expect(isValidLocalDate('2024-02-29')).toBe(true);
    expect(validateRange({ window: 'custom', from: '2026-07-29', to: '2026-07-29' }, 'UTC', now)).toEqual({ ok: true });
    expect(validateRange({ window: 'custom', from: '2026-04-29', to: '2026-07-29' }, 'UTC', now)).toEqual({ ok: true });
    expect(validateRange({ window: 'custom', from: '2026-04-28', to: '2026-07-29' }, 'UTC', now)).toEqual({ ok: false, reason: 'invalidRange' });
    expect(validateRange({ window: 'custom', from: '2026-07-30', to: '2026-07-30' }, 'UTC', now)).toEqual({ ok: false, reason: 'invalidRange' });
    expect(validateRange({ window: 'today' }, 'Foo/Bar', now)).toEqual({ ok: false, reason: 'invalidTimezone' });
    expect(validateRange({ window: 'last7d' }, 'Europe/Berlin', now)).toEqual({ ok: true });
  });

  it('serializes preset and custom range queries without adding a timezone fallback', () => {
    expect(toRangeQuery({ window: 'today' }, 'UTC')).toEqual({ window: 'today', tz: 'UTC' });
    expect(toRangeQuery({ window: 'custom', from: '2026-06-01', to: '2026-06-15' }, 'Europe/Berlin')).toEqual({ window: 'custom', tz: 'Europe/Berlin', from: '2026-06-01', to: '2026-06-15' });
  });

  it('formats delta null as new and keeps percentage-point units distinct', () => {
    expect(formatDeltaPct(null, 'en', 'New')).toBe('New');
    expect(formatDeltaPct(0, 'en', 'New')).toBe('0%');
    expect(formatDeltaPct(-100, 'en', 'New')).toBe('-100%');
    expect(formatDeltaPoints(2.5, 'en', 'New')).toBe('+2.5 pp');
  });

  it('marks incomplete ranges as estimates', () => {
    expect(comparisonState({ window: 'today', tz: 'UTC', from: '', to: '', isComplete: false })).toBe('estimate');
  });

  it('keeps pending routes and quick actions aligned with the approved matrix', () => {
    expect(PENDING_INBOX_LINKS).toEqual(expect.arrayContaining([
      { key: 'reports', href: null },
      { key: 'batch', href: null },
      { key: 'registrations', href: '/admin/users?tab=pending' },
    ]));
    expect(CHAT_QUICK_ACTIONS).toHaveLength(8);
    expect(CHAT_QUICK_ACTIONS.every((item) => item.i18nKey.startsWith('chatDashboard.quickActions.'))).toBe(true);
    expect(CHAT_QUICK_ACTIONS.find((item) => item.menuCode === 'resource-boosts')?.path).toBe('/admin/boosts');
    expect(CHAT_QUICK_ACTIONS.filter((item) => item.badgeSource)).toHaveLength(3);
  });
});
