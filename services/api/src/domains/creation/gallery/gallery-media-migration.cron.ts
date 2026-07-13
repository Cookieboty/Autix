import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { GalleryMediaMigrationService } from './gallery-media-migration.service';

/**
 * 广场作品媒体迁移定时 worker：每分钟捞一批 mediaMigrated=false 的作品迁移到 R2。
 * 独立于导入请求运行，进程重启也能下轮续跑；用 running 标记避免上一轮未完成时重叠执行。
 */
@Injectable()
export class GalleryMediaMigrationCron {
  private readonly logger = new Logger(GalleryMediaMigrationCron.name);
  private running = false;

  constructor(private readonly service: GalleryMediaMigrationService) {}

  @Interval(60_000)
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const res = await this.service.migratePendingBatch();
      if (res.scanned > 0) {
        this.logger.log(
          `tick: scanned=${res.scanned} settled=${res.settled} retry=${res.retry}`,
        );
      }
    } catch (err) {
      this.logger.error('gallery media migration tick failed', err as Error);
    } finally {
      this.running = false;
    }
  }
}
