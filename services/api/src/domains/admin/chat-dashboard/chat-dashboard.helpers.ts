import { HttpStatus } from '@nestjs/common';
import type {
  ChatDashboardAmountByCurrency,
  ChatDashboardCurrencyDeltaPct,
  ChatDashboardRangeQuery,
  ChatDashboardWindow,
} from '@autix/domain/admin/chat-dashboard';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SEARCH_MARGIN_MS = 36 * 60 * 60 * 1000;

export interface ResolvedDashboardRange {
  window: ChatDashboardWindow;
  tz: string;
  from: Date;
  to: Date;
  fromDate?: string;
  toDate?: string;
  isComplete: boolean;
  prev: { from: Date; to: Date };
}

function invalidRange(): never {
  throw new I18nHttpException(
    HttpStatus.BAD_REQUEST,
    'admin.chat_dashboard.invalid_range',
  );
}

export function assertValidIana(tz: string): void {
  if (typeof tz !== 'string' || tz.length === 0 || tz.length > 64) {
    throw new I18nHttpException(
      HttpStatus.BAD_REQUEST,
      'admin.chat_dashboard.invalid_timezone',
    );
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(0);
  } catch {
    throw new I18nHttpException(
      HttpStatus.BAD_REQUEST,
      'admin.chat_dashboard.invalid_timezone',
    );
  }
}

export function isValidLocalDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function localDateString(tz: string, at: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get('year')}-${values.get('month')}-${values.get('day')}`;
}

export function localMidnightToUtc(tz: string, dateStr: string): Date {
  if (!isValidLocalDate(dateStr)) return invalidRange();
  const [year, month, day] = dateStr.split('-').map(Number);
  const anchor = Date.UTC(year, month - 1, day);
  let low = anchor - SEARCH_MARGIN_MS;
  let high = anchor + SEARCH_MARGIN_MS;

  while (low < high) {
    const mid = low + Math.floor((high - low) / 2);
    if (localDateString(tz, new Date(mid)) < dateStr) low = mid + 1;
    else high = mid;
  }

  const candidate = new Date(low);
  if (localDateString(tz, candidate) !== dateStr) return invalidRange();
  return candidate;
}

export function addLocalDays(dateStr: string, deltaDays: number): string {
  if (!isValidLocalDate(dateStr) || !Number.isInteger(deltaDays)) {
    return invalidRange();
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return [
    String(date.getUTCFullYear()).padStart(4, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

export function daysBetweenLocal(fromDate: string, toDate: string): number {
  if (!isValidLocalDate(fromDate) || !isValidLocalDate(toDate)) {
    return invalidRange();
  }
  const toUtc = (value: string) => {
    const [year, month, day] = value.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtc(toDate) - toUtc(fromDate)) / 86_400_000);
}

export function resolveRange(
  query: ChatDashboardRangeQuery,
  now: Date = new Date(),
): ResolvedDashboardRange {
  assertValidIana(query.tz);
  const today = localDateString(query.tz, now);
  let fromDate: string;
  let toDate: string;

  if (query.window === 'today') {
    fromDate = today;
    toDate = today;
  } else if (query.window === 'yesterday') {
    fromDate = addLocalDays(today, -1);
    toDate = fromDate;
  } else if (query.window === 'last7d') {
    fromDate = addLocalDays(today, -6);
    toDate = today;
  } else {
    if (!('from' in query) || !('to' in query)) return invalidRange();
    fromDate = query.from;
    toDate = query.to;
    if (!isValidLocalDate(fromDate) || !isValidLocalDate(toDate)) {
      return invalidRange();
    }
    const spanDays = daysBetweenLocal(fromDate, toDate) + 1;
    if (
      fromDate > toDate ||
      toDate > today ||
      spanDays < 1 ||
      spanDays > 92 ||
      fromDate < addLocalDays(today, -400)
    ) {
      return invalidRange();
    }
  }

  const spanDays = daysBetweenLocal(fromDate, toDate) + 1;
  const from = localMidnightToUtc(query.tz, fromDate);
  const to = localMidnightToUtc(query.tz, addLocalDays(toDate, 1));
  const prevFromDate = addLocalDays(fromDate, -spanDays);
  const prevToDate = addLocalDays(fromDate, -1);

  return {
    window: query.window,
    tz: query.tz,
    from,
    to,
    ...(query.window === 'custom' ? { fromDate, toDate } : {}),
    isComplete: to.getTime() <= now.getTime(),
    prev: {
      from: localMidnightToUtc(query.tz, prevFromDate),
      to: localMidnightToUtc(query.tz, addLocalDays(prevToDate, 1)),
    },
  };
}

const roundOne = (value: number) => Math.round(value * 10) / 10;

/** Mirrors the repository CASE expression for the documented 0..100 risk scale. */
export function riskSeverityBucket(
  severity: number,
): 'A' | 'B' | 'C' | 'D' | 'E' | null {
  if (!Number.isFinite(severity) || severity < 0 || severity > 100) return null;
  if (severity === 0) return 'A';
  if (severity < 40) return 'B';
  if (severity < 70) return 'C';
  if (severity < 100) return 'D';
  return 'E';
}

export function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return roundOne(((current - previous) / previous) * 100);
}

export function successRateDeltaPoints(
  current: number | null,
  previous: number | null,
): number | null {
  if (current === null || previous === null) return null;
  return roundOne((current - previous) * 100);
}

export function mergeCurrencyDelta(
  current: ChatDashboardAmountByCurrency[],
  previous: ChatDashboardAmountByCurrency[],
): ChatDashboardCurrencyDeltaPct[] {
  const currentMap = new Map(current.map((item) => [item.currency, Number(item.amount)]));
  const previousMap = new Map(previous.map((item) => [item.currency, Number(item.amount)]));
  return [...new Set([...currentMap.keys(), ...previousMap.keys()])]
    .sort((a, b) => a.localeCompare(b))
    .map((currency) => ({
      currency,
      deltaPct: deltaPct(currentMap.get(currency) ?? 0, previousMap.get(currency) ?? 0),
    }));
}
