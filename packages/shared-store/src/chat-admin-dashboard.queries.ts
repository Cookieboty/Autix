import { useQuery } from '@tanstack/react-query';
import type { ChatDashboardRangeQuery } from '@autix/domain/admin/chat-dashboard';
import { useAuthStore, selectCurrentSystemCode } from './auth.store';
import { chatAdminDashboardActions } from './chat-admin-dashboard.actions';

export const serializeRangeQuery = (
  query: ChatDashboardRangeQuery,
): readonly string[] =>
  query.window === 'custom'
    ? [query.tz, query.window, query.from, query.to]
    : [query.tz, query.window];

export const chatAdminDashboardKeys = {
  all: ['chat-admin-dashboard'] as const,
  pendingInbox: () =>
    [...chatAdminDashboardKeys.all, 'pending-inbox'] as const,
  generationHealth: (query: ChatDashboardRangeQuery) =>
    [
      ...chatAdminDashboardKeys.all,
      'gen-health',
      ...serializeRangeQuery(query),
    ] as const,
  billingSummary: (query: ChatDashboardRangeQuery) =>
    [
      ...chatAdminDashboardKeys.all,
      'billing',
      ...serializeRangeQuery(query),
    ] as const,
  contentPulse: (query: ChatDashboardRangeQuery) =>
    [
      ...chatAdminDashboardKeys.all,
      'content-pulse',
      ...serializeRangeQuery(query),
    ] as const,
  riskSignals: (query: ChatDashboardRangeQuery) =>
    [
      ...chatAdminDashboardKeys.all,
      'risk-signals',
      ...serializeRangeQuery(query),
    ] as const,
};

type QueryOptions = { enabled?: boolean };

const disabledKey = (section: string) =>
  [...chatAdminDashboardKeys.all, section, 'disabled'] as const;

function useDashboardGate(opts?: QueryOptions) {
  const hydrated = useAuthStore((state) => state.hydrated);
  const systemCode = useAuthStore(selectCurrentSystemCode);
  const profileSyncStatus = useAuthStore((state) => state.profileSyncStatus);
  return (
    hydrated &&
    profileSyncStatus === 'ready' &&
    systemCode === 'chat' &&
    (opts?.enabled ?? true)
  );
}

export function useChatDashboardPendingInboxQuery(opts?: QueryOptions) {
  const enabled = useDashboardGate(opts);
  return useQuery({
    queryKey: chatAdminDashboardKeys.pendingInbox(),
    queryFn: chatAdminDashboardActions.pendingInbox,
    enabled,
  });
}

export function useChatDashboardGenerationHealthQuery(
  query: ChatDashboardRangeQuery | null,
  opts?: QueryOptions,
) {
  const enabled = useDashboardGate(opts) && query !== null;
  return useQuery({
    queryKey: query
      ? chatAdminDashboardKeys.generationHealth(query)
      : disabledKey('gen-health'),
    queryFn: () => {
      if (!query) throw new Error('Chat dashboard generation query is disabled');
      return chatAdminDashboardActions.generationHealth(query);
    },
    enabled,
  });
}

export function useChatDashboardBillingSummaryQuery(
  query: ChatDashboardRangeQuery | null,
  opts?: QueryOptions,
) {
  const enabled = useDashboardGate(opts) && query !== null;
  return useQuery({
    queryKey: query
      ? chatAdminDashboardKeys.billingSummary(query)
      : disabledKey('billing'),
    queryFn: () => {
      if (!query) throw new Error('Chat dashboard billing query is disabled');
      return chatAdminDashboardActions.billingSummary(query);
    },
    enabled,
  });
}

export function useChatDashboardContentPulseQuery(
  query: ChatDashboardRangeQuery | null,
  opts?: QueryOptions,
) {
  const enabled = useDashboardGate(opts) && query !== null;
  return useQuery({
    queryKey: query
      ? chatAdminDashboardKeys.contentPulse(query)
      : disabledKey('content-pulse'),
    queryFn: () => {
      if (!query) throw new Error('Chat dashboard content query is disabled');
      return chatAdminDashboardActions.contentPulse(query);
    },
    enabled,
  });
}

export function useChatDashboardRiskSignalsQuery(
  query: ChatDashboardRangeQuery | null,
  opts?: QueryOptions,
) {
  const enabled = useDashboardGate(opts) && query !== null;
  return useQuery({
    queryKey: query
      ? chatAdminDashboardKeys.riskSignals(query)
      : disabledKey('risk-signals'),
    queryFn: () => {
      if (!query) throw new Error('Chat dashboard risk query is disabled');
      return chatAdminDashboardActions.riskSignals(query);
    },
    enabled,
  });
}
