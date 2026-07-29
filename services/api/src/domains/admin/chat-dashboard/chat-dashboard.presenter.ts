import type {
  ChatDashboardAmountByCurrency,
  ChatDashboardResolvedRange,
} from '@autix/domain/admin/chat-dashboard';
import type { ResolvedDashboardRange } from './chat-dashboard.helpers';

export interface DisplayUserSource {
  id: string;
  status: string;
  nickname: string | null;
  realName: string | null;
  username: string;
}

export const decimalToString = (value: unknown): string => String(value ?? 0);

export function toDisplayName(user: DisplayUserSource | undefined): string {
  if (!user) return 'Unknown user';
  if (user.status === 'DELETED') return 'Deactivated user';
  return user.nickname?.trim() || user.realName?.trim() || user.username;
}

export function buildResolvedRange(
  range: ResolvedDashboardRange,
): ChatDashboardResolvedRange {
  return {
    window: range.window,
    tz: range.tz,
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    ...(range.fromDate ? { fromDate: range.fromDate } : {}),
    ...(range.toDate ? { toDate: range.toDate } : {}),
    isComplete: range.isComplete,
  };
}

export function presentAmounts(
  rows: Array<{ currency: string; amount: unknown }>,
): ChatDashboardAmountByCurrency[] {
  return rows
    .map((row) => ({ currency: row.currency, amount: decimalToString(row.amount) }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}
