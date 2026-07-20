import { Injectable } from '@nestjs/common';
import { AppLogger } from '../common/app-logger';
import { runInJobContext } from '../common/job-context';
import { Cron } from '@nestjs/schedule';
import { StorageCleanupService } from './storage-cleanup.service';

/**
 * T10（spec §3.2 A'）：storage_cleanup_tasks worker cron。
 * 每分钟触发一次；单轮流程：claimBatch → processBatch。
 *
 * 与其它 cron 时间错开：
 * - sse.service 3:00 每日清理
 * - AccountDeletionSweeperCron 3:15 每日清理
 * - StorageCleanupCron 每分钟（分片任务，量大且可延迟）
 *
 * 单轮容错：整体 try/catch，异常仅日志，下一轮再跑。
 */
@Injectable()
export class StorageCleanupCron {
  private readonly logger = new AppLogger(StorageCleanupCron.name);
  private readonly batchSize = 20;
  private running = false;

  constructor(private readonly cleanup: StorageCleanupService) {}

  @Cron('* * * * *')
  async runOnce() {
    return runInJobContext({ name: 'platform.storageCleanup', logger: this.logger }, async () => {
      // 防止上一轮尚未结束时重叠调度（例如 R2 抖动导致单轮拖长）
      if (this.running) {
        this.logger.debug('previous storage cleanup tick still running, skip this tick');
        return;
      }
      this.running = true;
      try {
        const now = new Date();
        // T16: 先扫过期 reservation，把它们转化为 cleanup task
        const expiredSummary = await this.cleanup.expirePendingReservations(now, 50);
        if (expiredSummary.expired > 0) {
          this.logger.log(
            `pending reservations expired: expired=${expiredSummary.expired}, enqueued=${expiredSummary.enqueued}`,
          );
        }
        const ids = await this.cleanup.claimBatch(now, this.batchSize);
        if (ids.length === 0) return;
        const summary = await this.cleanup.processBatch(ids);
        this.logger.log(
          `storage cleanup tick done: processed=${summary.processed}, completed=${summary.completed}, skipped=${summary.skipped}, retried=${summary.retried}, dead=${summary.dead}`,
        );
      } catch (error) {
        return { failed: true as const, error };
      } finally {
        this.running = false;
      }
    });
  }
}
