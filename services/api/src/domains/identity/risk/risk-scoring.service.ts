import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../platform/common/app-logger';
import { RiskRepository } from './risk.repository';
import { scoreUserSignals } from './risk-scoring.helpers';

/**
 * R2: 自动风险评分。聚合信号 → 评分 → 自动评级（最多 L2）；人工置级（manualOverride）不被覆盖。
 */
@Injectable()
export class RiskScoringService {
  private readonly logger = new AppLogger(RiskScoringService.name);

  constructor(private readonly riskRepository: RiskRepository) {}

  async evaluateUser(userId: string) {
    const signals = await this.riskRepository.gatherUserSignals(userId);
    const scored = scoreUserSignals(signals);
    const now = new Date();
    const topSignals = scored.signals.map((s) => s.type);

    const profile = await this.riskRepository.getRiskProfile(userId);

    if (profile?.manualOverride) {
      // 人工已置级：只刷新分数/信号，不改等级。
      await this.riskRepository.updateRiskScore(userId, {
        score: scored.score,
        topSignals,
        evaluatedAt: now,
      });
    } else {
      await this.riskRepository.upsertRiskProfile(userId, {
        level: scored.level,
        score: scored.score,
        topSignals,
        evaluatedAt: now,
      });
    }

    if (scored.signals.length > 0) {
      await this.riskRepository.createRiskEvent({
        userId,
        type: 'auto_eval',
        severity: scored.score,
        detail: { score: scored.score, level: scored.level, signals: topSignals },
        actorId: null,
      });
    }

    return scored;
  }

  async evaluatePending(): Promise<number> {
    const candidates = await this.riskRepository.listEvaluationCandidateIds();
    let evaluated = 0;
    for (const userId of candidates) {
      try {
        await this.evaluateUser(userId);
        evaluated += 1;
      } catch (err) {
        this.logger.warn(`risk evaluate failed: user=${userId} reason=${(err as Error).message}`);
      }
    }
    return evaluated;
  }
}
