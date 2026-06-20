import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdkMocks = vi.hoisted(() => ({
  inviteApi: {
    getCode: vi.fn(),
    getRecords: vi.fn(),
  },
}));

vi.mock('@autix/sdk', () => ({
  inviteApi: sdkMocks.inviteApi,
  membershipApi: {},
  orderApi: {},
  pointsApi: {},
}));

describe('membershipUserActions.getInviteOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the invite code when records fail to load', async () => {
    sdkMocks.inviteApi.getCode.mockResolvedValue({
      data: { id: 'code-1', code: 'AUTIX', userId: 'user-1' },
    });
    sdkMocks.inviteApi.getRecords.mockRejectedValue(new Error('records failed'));

    const { membershipUserActions } = await import('./membership-user.actions');
    const overview = await membershipUserActions.getInviteOverview();

    expect(overview.code?.code).toBe('AUTIX');
    expect(overview.records).toEqual([]);
  });

  it('keeps invite records when the code endpoint fails', async () => {
    sdkMocks.inviteApi.getCode.mockRejectedValue(new Error('code failed'));
    sdkMocks.inviteApi.getRecords.mockResolvedValue({
      data: [{ id: 'record-1', inviteeUserId: 'user-2' }],
    });

    const { membershipUserActions } = await import('./membership-user.actions');
    const overview = await membershipUserActions.getInviteOverview();

    expect(overview.code).toBeNull();
    expect(overview.records).toEqual([{ id: 'record-1', inviteeUserId: 'user-2' }]);
  });
});
