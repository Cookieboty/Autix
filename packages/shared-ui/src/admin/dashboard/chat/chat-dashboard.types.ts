import type { ChatDashboardWindow } from '@autix/domain/admin/chat-dashboard';

export interface ChatDashboardRangeState {
  window: ChatDashboardWindow;
  from?: string;
  to?: string;
}

export type ChatDashboardValidation =
  | { ok: true }
  | { ok: false; reason: 'invalidRange' | 'invalidTimezone' };

export interface PendingInboxLinkConfig {
  key: 'gallery' | 'reports' | 'templates' | 'registrations' | 'risk' | 'batch';
  href: string | null;
}

export interface ChatQuickActionConfig {
  menuCode: string;
  i18nKey: string;
  path: string;
  badgeSource?:
    | 'templatePendingCount'
    | 'galleryPendingCount'
    | 'pendingOrdersCount';
}

export interface ChatDashboardHeaderMetrics {
  pendingTotal?: number;
  generationSuccessRate?: number | null;
  billingGmvByCurrency?: Array<{ amount: string; currency: string }>;
  contentPublishedTotal?: number;
}

export interface DashboardSectionQuery<T> {
  data?: T;
  isLoading: boolean;
  isError: boolean;
  refetch: () => unknown;
}
