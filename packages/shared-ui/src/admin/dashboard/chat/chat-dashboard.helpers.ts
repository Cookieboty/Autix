import type {
  ChatDashboardBillingSummary,
  ChatDashboardContentPulse,
  ChatDashboardGenerationHealth,
  ChatDashboardPendingInbox,
  ChatDashboardRangeQuery,
  ChatDashboardResolvedRange,
} from '@autix/domain/admin/chat-dashboard';
import type {
  ChatDashboardRangeState,
  ChatDashboardHeaderMetrics,
  ChatDashboardValidation,
  PendingInboxLinkConfig,
  ChatQuickActionConfig,
} from './chat-dashboard.types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const PENDING_INBOX_LINKS: readonly PendingInboxLinkConfig[] = [
  { key: 'gallery', href: '/admin/gallery' },
  { key: 'reports', href: null },
  { key: 'templates', href: '/admin/templates' },
  { key: 'registrations', href: '/admin/users?tab=pending' },
  { key: 'risk', href: '/admin/risk' },
  { key: 'batch', href: null },
];

export const CHAT_QUICK_ACTIONS: readonly ChatQuickActionConfig[] = [
  { menuCode: 'template-review', i18nKey: 'chatDashboard.quickActions.templates', path: '/admin/templates', badgeSource: 'templatePendingCount' },
  { menuCode: 'gallery-review', i18nKey: 'chatDashboard.quickActions.gallery', path: '/admin/gallery', badgeSource: 'galleryPendingCount' },
  { menuCode: 'generation-tasks', i18nKey: 'chatDashboard.quickActions.generationTasks', path: '/admin/generation-tasks' },
  { menuCode: 'campaign-rewards', i18nKey: 'chatDashboard.quickActions.campaigns', path: '/admin/campaigns' },
  { menuCode: 'featured-slots', i18nKey: 'chatDashboard.quickActions.featuredSlots', path: '/admin/featured-slots' },
  { menuCode: 'resource-boosts', i18nKey: 'chatDashboard.quickActions.boosts', path: '/admin/boosts' },
  { menuCode: 'membership-orders', i18nKey: 'chatDashboard.quickActions.orders', path: '/admin/membership/orders', badgeSource: 'pendingOrdersCount' },
  { menuCode: 'membership-points', i18nKey: 'chatDashboard.quickActions.points', path: '/admin/membership/points' },
];

export function isValidLocalDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isValidIanaTimezone(tz: string | null | undefined): tz is string {
  if (!tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function localDateString(tz: string, at: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const values = new Map(parts.map((part) => [part.type, part.value] as const));
  return `${values.get('year')}-${values.get('month')}-${values.get('day')}`;
}

function toUtcDay(value: string): number {
  const [year, month, day] = value.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

export function addLocalDays(value: string, days: number): string {
  if (!isValidLocalDate(value)) return value;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, '0'), String(date.getUTCDate()).padStart(2, '0')].join('-');
}

export function validateRange(
  range: ChatDashboardRangeState,
  tz: string | null | undefined,
  now = new Date(),
): ChatDashboardValidation {
  if (!isValidIanaTimezone(tz)) return { ok: false, reason: 'invalidTimezone' };
  if (range.window !== 'custom') return { ok: true };
  if (!range.from || !range.to || !isValidLocalDate(range.from) || !isValidLocalDate(range.to)) {
    return { ok: false, reason: 'invalidRange' };
  }
  const today = localDateString(tz, now);
  const span = Math.round((toUtcDay(range.to) - toUtcDay(range.from)) / 86_400_000) + 1;
  if (
    range.from > range.to ||
    range.to > today ||
    span < 1 ||
    span > 92 ||
    range.from < addLocalDays(today, -400)
  ) {
    return { ok: false, reason: 'invalidRange' };
  }
  return { ok: true };
}

export function toRangeQuery(
  range: ChatDashboardRangeState,
  tz: string,
): ChatDashboardRangeQuery | null {
  if (range.window === 'custom') {
    if (!range.from || !range.to) return null;
    return { tz, window: 'custom', from: range.from, to: range.to };
  }
  return { tz, window: range.window };
}

export function deriveHeaderMetrics(input: {
  pending?: ChatDashboardPendingInbox;
  generation?: ChatDashboardGenerationHealth;
  billing?: ChatDashboardBillingSummary;
  content?: ChatDashboardContentPulse;
}): ChatDashboardHeaderMetrics {
  const pending = input.pending;
  return {
    pendingTotal: pending
      ? pending.galleryPendingCount + pending.galleryPendingReportCount + pending.templatePendingCount + pending.registrationPendingCount + pending.riskFlaggedUserCount + pending.batchJobProcessingCount
      : undefined,
    generationSuccessRate: input.generation?.successRate,
    billingGmvByCurrency: input.billing?.gmv,
    contentPublishedTotal: input.content?.galleryPublished.total,
  };
}

export const formatNumber = (value: number, locale: string) =>
  new Intl.NumberFormat(locale).format(value);

export const formatRate = (value: number | null, locale: string) =>
  value === null ? '—' : new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(value);

export function formatDeltaPct(value: number | null, locale: string, newLabel: string): string {
  if (value === null) return newLabel;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1, signDisplay: value === 0 ? 'auto' : 'always' }).format(value)}%`;
}

export function formatDeltaPoints(value: number | null, locale: string, newLabel: string): string {
  if (value === null) return newLabel;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1, signDisplay: value === 0 ? 'auto' : 'always' }).format(value)} pp`;
}

export function formatCurrency(amount: string, currency: string, locale: string): string {
  const value = Number(amount);
  if (currency === 'UNKNOWN' || !Number.isFinite(value)) return `${amount} ${currency}`;
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
  } catch {
    return `${amount} ${currency}`;
  }
}

export const formatEventTime = (value: string, locale: string, tz: string) =>
  new Intl.DateTimeFormat(locale, { timeZone: tz, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export const comparisonState = (range: ChatDashboardResolvedRange) =>
  range.isComplete ? 'complete' as const : 'estimate' as const;
