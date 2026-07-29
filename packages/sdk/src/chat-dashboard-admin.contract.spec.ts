import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userApi: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  chatApi: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  createApiInstance: vi.fn(),
}));

vi.mock('./client-core', () => ({
  createApiInstance: mocks.createApiInstance,
  getApiBaseUrl: vi.fn(() => 'http://localhost'),
  LLM_REQUEST_TIMEOUT_MS: 1_000,
}));

let chatDashboardAdminApi: typeof import('./client').chatDashboardAdminApi;

describe('chatDashboardAdminApi HTTP contract', () => {
  beforeAll(async () => {
    mocks.createApiInstance
      .mockReturnValueOnce(mocks.userApi)
      .mockReturnValueOnce(mocks.chatApi);
    ({ chatDashboardAdminApi } = await import('./client'));
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps Pending parameter-free and forwards the shared range to four GET endpoints', () => {
    const query = {
      tz: 'Europe/Berlin',
      window: 'custom',
      from: '2026-06-01',
      to: '2026-06-15',
    } as const;

    chatDashboardAdminApi.pendingInbox();
    chatDashboardAdminApi.generationHealth(query);
    chatDashboardAdminApi.billingSummary(query);
    chatDashboardAdminApi.contentPulse(query);
    chatDashboardAdminApi.riskSignals(query);

    expect(mocks.chatApi.get.mock.calls).toEqual([
      ['/api/admin/chat-dashboard/pending-inbox'],
      ['/api/admin/chat-dashboard/generation-health', { params: query }],
      ['/api/admin/chat-dashboard/billing-summary', { params: query }],
      ['/api/admin/chat-dashboard/content-pulse', { params: query }],
      ['/api/admin/chat-dashboard/risk-signals', { params: query }],
    ]);
  });
});
