import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  auth: {
    hydrated: true,
    profileSyncStatus: 'ready',
    systemCode: 'chat' as string | undefined,
  },
  useQuery: vi.fn((options: unknown) => options),
  actions: {
    pendingInbox: vi.fn(),
    generationHealth: vi.fn(),
    billingSummary: vi.fn(),
    contentPulse: vi.fn(),
    riskSignals: vi.fn(),
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: state.useQuery,
}));

vi.mock('./auth.store', () => ({
  selectCurrentSystemCode: (value: typeof state.auth) => value.systemCode,
  useAuthStore: (selector: (value: typeof state.auth) => unknown) =>
    selector(state.auth),
}));

vi.mock('./chat-admin-dashboard.actions', () => ({
  chatAdminDashboardActions: state.actions,
}));

let dashboard: typeof import('./chat-admin-dashboard.queries');

describe('chat admin dashboard query contract', () => {
  beforeAll(async () => {
    dashboard = await import('./chat-admin-dashboard.queries');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    state.auth = {
      hydrated: true,
      profileSyncStatus: 'ready',
      systemCode: 'chat',
    };
  });

  it('uses the exact root and section segments', () => {
    const preset = { tz: 'UTC', window: 'today' } as const;
    expect(dashboard.chatAdminDashboardKeys.all).toEqual(['chat-admin-dashboard']);
    expect(dashboard.chatAdminDashboardKeys.pendingInbox()).toEqual([
      'chat-admin-dashboard',
      'pending-inbox',
    ]);
    expect(dashboard.chatAdminDashboardKeys.generationHealth(preset)).toEqual([
      'chat-admin-dashboard',
      'gen-health',
      'UTC',
      'today',
    ]);
    expect(dashboard.chatAdminDashboardKeys.billingSummary(preset)).toEqual([
      'chat-admin-dashboard',
      'billing',
      'UTC',
      'today',
    ]);
    expect(dashboard.chatAdminDashboardKeys.contentPulse(preset)).toEqual([
      'chat-admin-dashboard',
      'content-pulse',
      'UTC',
      'today',
    ]);
    expect(dashboard.chatAdminDashboardKeys.riskSignals(preset)).toEqual([
      'chat-admin-dashboard',
      'risk-signals',
      'UTC',
      'today',
    ]);
  });

  it('includes from/to only for custom queries', () => {
    const preset = { tz: 'UTC', window: 'today' } as const;
    const custom = {
      tz: 'Europe/Berlin',
      window: 'custom',
      from: '2026-06-01',
      to: '2026-06-15',
    } as const;
    expect(dashboard.serializeRangeQuery(preset)).toEqual(['UTC', 'today']);
    expect(dashboard.serializeRangeQuery(custom)).toEqual([
      'Europe/Berlin',
      'custom',
      '2026-06-01',
      '2026-06-15',
    ]);
  });

  it.each([
    ['not hydrated', false, 'ready', 'chat', true],
    ['profile syncing', true, 'syncing', 'chat', true],
    ['profile broken', true, 'broken', 'chat', true],
    ['non-chat system', true, 'ready', 'admin-system', true],
    ['caller disabled', true, 'ready', 'chat', false],
  ])(
    'disables pending queries when %s',
    (_label, hydrated, profileSyncStatus, systemCode, callerEnabled) => {
      state.auth = { hydrated, profileSyncStatus, systemCode };
      const options = dashboard.useChatDashboardPendingInboxQuery({
        enabled: callerEnabled,
      }) as unknown as { enabled: boolean };
      expect(options.enabled).toBe(false);
    },
  );

  it('enables pending only for a hydrated, ready Chat profile', () => {
    const options = dashboard.useChatDashboardPendingInboxQuery() as unknown as {
      enabled: boolean;
      queryKey: readonly string[];
    };
    expect(options.enabled).toBe(true);
    expect(options.queryKey).toEqual(['chat-admin-dashboard', 'pending-inbox']);
  });

  it('uses a non-request sentinel for null ranges and never fabricates UTC/today', () => {
    const options = dashboard.useChatDashboardGenerationHealthQuery(null) as unknown as {
      enabled: boolean;
      queryKey: readonly string[];
    };
    expect(options.enabled).toBe(false);
    expect(options.queryKey).toEqual([
      'chat-admin-dashboard',
      'gen-health',
      'disabled',
    ]);
    expect(options.queryKey).not.toContain('UTC');
    expect(options.queryKey).not.toContain('today');
    expect(state.actions.generationHealth).not.toHaveBeenCalled();
  });

  it.each([
    ['billing', () => dashboard.useChatDashboardBillingSummaryQuery(null), state.actions.billingSummary],
    ['content-pulse', () => dashboard.useChatDashboardContentPulseQuery(null), state.actions.contentPulse],
    ['risk-signals', () => dashboard.useChatDashboardRiskSignalsQuery(null), state.actions.riskSignals],
  ])('uses a disabled sentinel for the %s null-range hook', (section, useHook, action) => {
    const options = useHook() as unknown as {
      enabled: boolean;
      queryKey: readonly string[];
    };
    expect(options.enabled).toBe(false);
    expect(options.queryKey).toEqual([
      'chat-admin-dashboard',
      section,
      'disabled',
    ]);
    expect(action).not.toHaveBeenCalled();
  });

  it('uses the domain range unchanged for the enabled query key and action', async () => {
    const query = {
      tz: 'Europe/Berlin',
      window: 'custom',
      from: '2026-06-01',
      to: '2026-06-15',
    } as const;
    state.actions.generationHealth.mockResolvedValueOnce({ ok: true });
    const options = dashboard.useChatDashboardGenerationHealthQuery(query) as unknown as {
      enabled: boolean;
      queryKey: readonly string[];
      queryFn: () => Promise<unknown>;
    };

    expect(options.enabled).toBe(true);
    expect(options.queryKey).toEqual([
      'chat-admin-dashboard',
      'gen-health',
      'Europe/Berlin',
      'custom',
      '2026-06-01',
      '2026-06-15',
    ]);
    await options.queryFn();
    expect(state.actions.generationHealth).toHaveBeenCalledWith(query);
  });
});
