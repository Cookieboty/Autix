import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  pendingInbox: vi.fn(),
  generationHealth: vi.fn(),
  billingSummary: vi.fn(),
  contentPulse: vi.fn(),
  riskSignals: vi.fn(),
}));

vi.mock('@autix/sdk', () => ({ chatDashboardAdminApi: api }));

describe('chat dashboard action/SDK contract', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes no params to pending and the exact shared range to four window actions', async () => {
    const { chatAdminDashboardActions } = await import('./chat-admin-dashboard.actions');
    const query = { tz: 'UTC', window: 'last7d' } as const;
    for (const mock of Object.values(api)) mock.mockResolvedValue({ data: { ok: true } });

    await chatAdminDashboardActions.pendingInbox();
    await chatAdminDashboardActions.generationHealth(query);
    await chatAdminDashboardActions.billingSummary(query);
    await chatAdminDashboardActions.contentPulse(query);
    await chatAdminDashboardActions.riskSignals(query);

    expect(api.pendingInbox).toHaveBeenCalledWith();
    expect(api.generationHealth).toHaveBeenCalledWith(query);
    expect(api.billingSummary).toHaveBeenCalledWith(query);
    expect(api.contentPulse).toHaveBeenCalledWith(query);
    expect(api.riskSignals).toHaveBeenCalledWith(query);
  });
});
