import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RiskScoringService } from './risk-scoring.service';

/**
 * R2: 定时对近期注册 + 已标记用户做风险评分（每 30 分钟）。
 */
@Injectable()
export class RiskEvaluationCron {
  private readonly logger = new Logger(RiskEvaluationCron.name);

  constructor(private readonly scoringService: RiskScoringService) {}

  @Cron('*/30 * * * *')
  async evaluate() {
    try {
      const n = await this.scoringService.evaluatePending();
      if (n > 0) this.logger.log(`risk evaluated users: ${n}`);
    } catch (error) {
      this.logger.error('risk evaluation failed', error as Error);
    }
  }
}
