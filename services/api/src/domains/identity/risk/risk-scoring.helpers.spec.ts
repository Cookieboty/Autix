import {
  autoLevelFromScore,
  scoreUserSignals,
  type UserRiskSignals,
} from './risk-scoring.helpers';

const zero: UserRiskSignals = {
  sameIpUsers: 0,
  sameDeviceUsers: 0,
  inviteTotal: 0,
  inviteBurst: 0,
  paidOrders: 0,
  refundedOrders: 0,
};

describe('autoLevelFromScore', () => {
  it('maps score ranges to L0/L1/L2 and never auto-assigns L3', () => {
    expect(autoLevelFromScore(0)).toBe('L0');
    expect(autoLevelFromScore(39)).toBe('L0');
    expect(autoLevelFromScore(40)).toBe('L1');
    expect(autoLevelFromScore(69)).toBe('L1');
    expect(autoLevelFromScore(70)).toBe('L2');
    expect(autoLevelFromScore(100)).toBe('L2');
  });
});

describe('scoreUserSignals', () => {
  it('returns L0 with empty signals for a clean user', () => {
    const r = scoreUserSignals(zero);
    expect(r.score).toBe(0);
    expect(r.level).toBe('L0');
    expect(r.signals).toEqual([]);
  });

  it('flags a device-sharing sybil cluster', () => {
    const r = scoreUserSignals({ ...zero, sameDeviceUsers: 4 });
    expect(r.signals.map((s) => s.type)).toContain('sybil_device');
    expect(r.score).toBeGreaterThan(0);
  });

  it('accumulates multiple signals and caps the score at 100', () => {
    const r = scoreUserSignals({
      sameIpUsers: 9,
      sameDeviceUsers: 9,
      inviteTotal: 80,
      inviteBurst: 30,
      paidOrders: 4,
      refundedOrders: 4,
    });
    expect(r.score).toBe(100);
    expect(r.level).toBe('L2');
    expect(r.signals.map((s) => s.type)).toEqual(
      expect.arrayContaining(['sybil_ip', 'sybil_device', 'invite_burst', 'invite_volume', 'refund_abuse']),
    );
  });

  it('only counts refund_abuse when there are enough paid orders', () => {
    expect(scoreUserSignals({ ...zero, paidOrders: 1, refundedOrders: 1 }).signals).toEqual([]);
    expect(
      scoreUserSignals({ ...zero, paidOrders: 4, refundedOrders: 3 }).signals.map((s) => s.type),
    ).toContain('refund_abuse');
  });
});
