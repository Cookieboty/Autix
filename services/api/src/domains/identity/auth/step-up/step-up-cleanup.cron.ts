import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StepUpRepository } from './step-up.repository';

/**
 * spec §3.2 D'：step-up 一次性凭证后台清理。
 * 每日 03:45 触发（与其它每日 job 错峰）。
 * 删除已过期的 `email_otps` 与 `step_up_proofs`（均为 5min 级 ephemeral 记录），保证磁盘有界。
 */
@Injectable()
export class StepUpCleanupCron {
  private readonly logger = new Logger(StepUpCleanupCron.name);

  constructor(private readonly repo: StepUpRepository) {}

  @Cron('45 3 * * *')
  async runOnce() {
    try {
      const { otps, proofs } = await this.repo.deleteExpiredChallenges(new Date());
      if (otps > 0 || proofs > 0) {
        this.logger.log(`step-up cleanup: email_otps=${otps}, step_up_proofs=${proofs}`);
      }
    } catch (error) {
      this.logger.error('step-up cleanup crashed', error as Error);
    }
  }
}
