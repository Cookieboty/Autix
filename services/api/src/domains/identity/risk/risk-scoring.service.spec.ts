import { RiskScoringService } from './risk-scoring.service';

function buildService(overrides: any = {}) {
  const repo: any = {
    gatherUserSignals: vi.fn(async () => overrides.signals ?? {
      sameIpUsers: 0,
      sameDeviceUsers: 0,
      inviteTotal: 0,
      inviteBurst: 0,
      paidOrders: 0,
      refundedOrders: 0,
    }),
    getRiskProfile: vi.fn(async () => overrides.profile ?? null),
    upsertRiskProfile: vi.fn(async (userId: string, data: any) => ({ userId, ...data })),
    updateRiskScore: vi.fn(async () => ({})),
    createRiskEvent: vi.fn(async () => ({})),
    listEvaluationCandidateIds: vi.fn(async () => overrides.candidates ?? []),
  };
  const service = new RiskScoringService(repo);
  return { service, repo };
}

describe('RiskScoringService.evaluateUser', () => {
  it('auto-sets level/score from signals and records an event when signals hit', async () => {
    const { service, repo } = buildService({
      signals: { sameIpUsers: 0, sameDeviceUsers: 4, inviteTotal: 0, inviteBurst: 0, paidOrders: 0, refundedOrders: 0 },
    });

    const result = await service.evaluateUser('u1');

    expect(result.level).toBe('L0'); // 30 分 < 40 → L0，但有信号
    expect(repo.upsertRiskProfile).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ score: 30, topSignals: ['sybil_device'] }),
    );
    expect(repo.createRiskEvent).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', type: 'auto_eval' }),
    );
  });

  it('promotes to L2 when score crosses the threshold', async () => {
    const { service, repo } = buildService({
      signals: { sameIpUsers: 9, sameDeviceUsers: 9, inviteTotal: 0, inviteBurst: 30, paidOrders: 0, refundedOrders: 0 },
    });

    const result = await service.evaluateUser('u1');

    expect(result.level).toBe('L2');
    expect(repo.upsertRiskProfile).toHaveBeenCalledWith('u1', expect.objectContaining({ level: 'L2' }));
  });

  it('does NOT override a manually-set level, only refreshes the score', async () => {
    const { service, repo } = buildService({
      signals: { sameIpUsers: 9, sameDeviceUsers: 9, inviteTotal: 0, inviteBurst: 30, paidOrders: 0, refundedOrders: 0 },
      profile: { userId: 'u1', level: 'L3', manualOverride: true },
    });

    await service.evaluateUser('u1');

    expect(repo.upsertRiskProfile).not.toHaveBeenCalled();
    expect(repo.updateRiskScore).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ score: expect.any(Number) }),
    );
  });

  it('records no event for a clean user with no signals', async () => {
    const { service, repo } = buildService();
    await service.evaluateUser('u1');
    expect(repo.createRiskEvent).not.toHaveBeenCalled();
  });
});

describe('RiskScoringService.evaluatePending', () => {
  it('evaluates each candidate and returns the count', async () => {
    const { service, repo } = buildService({ candidates: ['a', 'b', 'c'] });
    const spy = vi.spyOn(service, 'evaluateUser').mockResolvedValue({} as never);

    const n = await service.evaluatePending();

    expect(repo.listEvaluationCandidateIds).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledTimes(3);
    expect(n).toBe(3);
  });
});
