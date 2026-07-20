import { Injectable } from '@nestjs/common';
import { AppLogger } from './app-logger';
import { runInJobContext } from './job-context';
import { Cron } from '@nestjs/schedule';
import { RateLimitRepository } from './rate-limit.repository';

/**
 * spec §3.2 D'''：限流计数表后台清理。
 * 每日 03:30 触发（与其它每日 job 错峰：sse 3:00 / 账号删除 sweeper 3:15）。
 * 删除早已过期的 `rate_limit_counters` 行，保证磁盘增长有界。
 */
@Injectable()
export class RateLimitCleanupCron {
  private readonly logger = new AppLogger(RateLimitCleanupCron.name);

  constructor(private readonly repo: RateLimitRepository) {}

  @Cron('30 3 * * *')
  async runOnce() {
    return runInJobContext({ name: 'platform.rateLimitCleanup', logger: this.logger }, async () => {
      try {
        const deleted = await this.repo.deleteExpired(new Date());
        if (deleted > 0) {
          this.logger.log(`rate_limit_counters cleanup: deleted=${deleted}`);
        }
      } catch (error) {
        return { failed: true as const, error };
      }
    });
  }
}
