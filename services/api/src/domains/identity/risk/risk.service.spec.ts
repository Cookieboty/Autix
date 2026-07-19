import { RiskService } from './risk.service';

function buildService(overrides: any = {}) {
  const repo: any = {
    listRiskProfiles: vi.fn(async () => overrides.profiles ?? []),
    countRiskProfiles: vi.fn(async () => overrides.total ?? 0),
    findInvitersFor: vi.fn(async () => overrides.inviters ?? new Map()),
    countInviteesFor: vi.fn(async () => overrides.inviteeCounts ?? new Map()),
    getRiskProfile: vi.fn(async () => overrides.profile ?? null),
    findInviter: vi.fn(async () => overrides.inviter ?? null),
    listInvitees: vi.fn(async () => overrides.invitees ?? []),
    listRiskEvents: vi.fn(async () => overrides.events ?? []),
    upsertRiskProfile: vi.fn(async (userId: string, data: any) => ({ userId, ...data })),
    createRiskEvent: vi.fn(async () => ({})),
    setUserStatus: vi.fn(async () => ({})),
    clawbackInviteRewardForInvitee: vi.fn(async () => ({ grants: 1, clawedBack: 100 })),
  };
  const service = new RiskService(repo);
  return { service, repo };
}

describe('RiskService.listFlaggedUsers', () => {
  it('assembles each user with level, score, inviter and invite count', async () => {
    const { service } = buildService({
      profiles: [
        { userId: 'u1', level: 'L2', score: 75, topSignals: ['invite_burst'], user: { id: 'u1', username: 'a', email: 'a@x', status: 'ACTIVE' } },
      ],
      total: 1,
      inviters: new Map([['u1', { id: 'inv1', username: 'boss', email: 'b@x' }]]),
      inviteeCounts: new Map([['u1', 12]]),
    });

    const result = await service.listFlaggedUsers({ level: 'L2', page: 1, pageSize: 20 });

    expect(result.total).toBe(1);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        user: expect.objectContaining({ id: 'u1', username: 'a' }),
        level: 'L2',
        score: 75,
        inviter: expect.objectContaining({ id: 'inv1', username: 'boss' }),
        inviteCount: 12,
      }),
    );
  });

  it('defaults invite count to 0 and inviter to null when absent', async () => {
    const { service } = buildService({
      profiles: [{ userId: 'u2', level: 'L1', score: 40, user: { id: 'u2' } }],
      total: 1,
    });
    const result = await service.listFlaggedUsers({ page: 1, pageSize: 20 });
    expect(result.items[0].inviteCount).toBe(0);
    expect(result.items[0].inviter).toBeNull();
  });
});

describe('RiskService.setLevel', () => {
  it('blocks the user (status DISABLED) and records an audit event when set to L3', async () => {
    const { service, repo } = buildService();

    await service.setLevel('admin-1', 'u1', 'L3', '确认刷量');

    expect(repo.upsertRiskProfile).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ level: 'L3', manualOverride: true }),
    );
    expect(repo.setUserStatus).toHaveBeenCalledWith('u1', 'DISABLED');
    expect(repo.createRiskEvent).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', type: 'manual_level', actorId: 'admin-1' }),
    );
    // R2/FIX-13: 封号时追回邀请人对该被邀请人的邀请奖励。
    expect(repo.clawbackInviteRewardForInvitee).toHaveBeenCalledWith('u1');
  });

  it('unblocks the user (status ACTIVE) when set below L3 and does not clawback', async () => {
    const { service, repo } = buildService();

    await service.setLevel('admin-1', 'u1', 'L1', '复核解除');

    expect(repo.setUserStatus).toHaveBeenCalledWith('u1', 'ACTIVE');
    expect(repo.clawbackInviteRewardForInvitee).not.toHaveBeenCalled();
  });

  it('rejects an invalid level', async () => {
    const { service } = buildService();
    await expect(service.setLevel('admin-1', 'u1', 'L9' as any, 'x'))
      .rejects.toMatchObject({ i18nKey: 'risk.level_invalid' });
  });
});

describe('RiskService.getUserRiskDetail', () => {
  it('returns profile, inviter, invitees and event timeline', async () => {
    const { service } = buildService({
      profile: { userId: 'u1', level: 'L2', score: 60, user: { id: 'u1', username: 'a' } },
      inviter: { id: 'inv1', username: 'boss' },
      invitees: [{ id: 'd1' }, { id: 'd2' }],
      events: [{ id: 'e1', type: 'invite_burst' }],
    });

    const detail = await service.getUserRiskDetail('u1');

    expect(detail.inviter).toEqual(expect.objectContaining({ id: 'inv1' }));
    expect(detail.invitees).toHaveLength(2);
    expect(detail.events).toHaveLength(1);
    expect(detail.profile.level).toBe('L2');
  });
});
