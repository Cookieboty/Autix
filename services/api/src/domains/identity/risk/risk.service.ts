import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { RiskRepository } from './risk.repository';

export const RISK_LEVELS = ['L0', 'L1', 'L2', 'L3'] as const;
export type RiskLevelValue = (typeof RISK_LEVELS)[number];

export interface ListFlaggedUsersQuery {
  level?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class RiskService {
  private readonly logger = new Logger(RiskService.name);

  constructor(private readonly riskRepository: RiskRepository) {}

  async listFlaggedUsers(query: ListFlaggedUsersQuery) {
    const page = Math.max(1, Math.floor(query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Math.floor(query.pageSize ?? 20)));
    const level = this.normalizeOptionalLevel(query.level);

    const [profiles, total] = await Promise.all([
      this.riskRepository.listRiskProfiles({ level, skip: (page - 1) * pageSize, take: pageSize }),
      this.riskRepository.countRiskProfiles({ level }),
    ]);

    const userIds = profiles.map((p) => p.userId);
    const [inviters, inviteeCounts] = await Promise.all([
      this.riskRepository.findInvitersFor(userIds),
      this.riskRepository.countInviteesFor(userIds),
    ]);

    const items = profiles.map((p) => ({
      user: p.user,
      level: p.level,
      score: p.score,
      topSignals: p.topSignals ?? null,
      inviter: inviters.get(p.userId) ?? null,
      inviteCount: inviteeCounts.get(p.userId) ?? 0,
    }));

    return { items, total, page, pageSize };
  }

  async getUserRiskDetail(userId: string) {
    const [profile, inviter, invitees, events] = await Promise.all([
      this.riskRepository.getRiskProfile(userId),
      this.riskRepository.findInviter(userId),
      this.riskRepository.listInvitees(userId),
      this.riskRepository.listRiskEvents(userId, 100),
    ]);

    return {
      profile: profile ?? { userId, level: 'L0', score: 0 },
      inviter: inviter ?? null,
      invitees,
      inviteCount: invitees.length,
      events,
    };
  }

  async setLevel(actorId: string, userId: string, level: RiskLevelValue, reason?: string) {
    if (!RISK_LEVELS.includes(level)) {
      throw new BadRequestException('无效的风控等级');
    }

    const now = new Date();
    const blocked = level === 'L3';
    const profile = await this.riskRepository.upsertRiskProfile(userId, {
      level,
      manualOverride: true,
      evaluatedAt: now,
      blockedAt: blocked ? now : null,
      blockedReason: blocked ? reason ?? null : null,
    });

    // L3 = 封禁，同步 User.status；降级则解封恢复 ACTIVE。
    await this.riskRepository.setUserStatus(userId, blocked ? 'DISABLED' : 'ACTIVE');

    await this.riskRepository.createRiskEvent({
      userId,
      type: 'manual_level',
      severity: 0,
      detail: { level, reason: reason ?? null },
      actorId,
    });

    // R2/FIX-13: 封号时追回"邀请人因邀请该用户获得的邀请奖励"（best-effort）。
    if (blocked) {
      try {
        const result = await this.riskRepository.clawbackInviteRewardForInvitee(userId);
        if (result.clawedBack > 0) {
          await this.riskRepository.createRiskEvent({
            userId,
            type: 'clawback',
            severity: 0,
            detail: result,
            actorId,
          });
        }
      } catch (err) {
        this.logger.warn(
          `invite reward clawback failed: invitee=${userId} reason=${(err as Error).message}`,
        );
      }
    }

    return profile;
  }

  block(actorId: string, userId: string, reason?: string) {
    return this.setLevel(actorId, userId, 'L3', reason);
  }

  unblock(actorId: string, userId: string, reason?: string) {
    return this.setLevel(actorId, userId, 'L0', reason);
  }

  private normalizeOptionalLevel(level?: string): RiskLevelValue | undefined {
    if (!level) return undefined;
    if (!RISK_LEVELS.includes(level as RiskLevelValue)) {
      throw new BadRequestException('无效的风控等级');
    }
    return level as RiskLevelValue;
  }
}
