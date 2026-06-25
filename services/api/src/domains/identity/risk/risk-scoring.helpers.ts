import type { RiskLevelValue } from './risk.service';

/**
 * R2: 风险评分（纯函数）。signals → score → 自动等级。
 * 自动评级最多到 L2（受限）；**L3（封禁）仅人工**，避免误封。阈值与权重可按业务调整。
 */
export interface UserRiskSignals {
  sameIpUsers: number; // 同 signupIp 的其他用户数
  sameDeviceUsers: number; // 同 signupDeviceId 的其他用户数
  inviteTotal: number; // 累计邀请人数
  inviteBurst: number; // 近 24h 邀请人数
  paidOrders: number;
  refundedOrders: number;
}

export interface RiskSignalHit {
  type: string;
  severity: number;
}

const SIGNAL_RULES: Array<{ type: string; severity: number; test: (s: UserRiskSignals) => boolean }> = [
  { type: 'sybil_ip', severity: 25, test: (s) => s.sameIpUsers >= 5 },
  { type: 'sybil_device', severity: 30, test: (s) => s.sameDeviceUsers >= 3 },
  { type: 'invite_burst', severity: 20, test: (s) => s.inviteBurst >= 10 },
  { type: 'invite_volume', severity: 15, test: (s) => s.inviteTotal >= 50 },
  {
    type: 'refund_abuse',
    severity: 25,
    test: (s) => s.paidOrders >= 2 && s.refundedOrders / s.paidOrders >= 0.5,
  },
];

export function scoreUserSignals(signals: UserRiskSignals): {
  score: number;
  level: RiskLevelValue;
  signals: RiskSignalHit[];
} {
  const hits = SIGNAL_RULES.filter((rule) => rule.test(signals)).map((rule) => ({
    type: rule.type,
    severity: rule.severity,
  }));
  const score = Math.min(100, hits.reduce((sum, h) => sum + h.severity, 0));
  return { score, level: autoLevelFromScore(score), signals: hits };
}

export function autoLevelFromScore(score: number): RiskLevelValue {
  if (score >= 70) return 'L2';
  if (score >= 40) return 'L1';
  return 'L0';
}
