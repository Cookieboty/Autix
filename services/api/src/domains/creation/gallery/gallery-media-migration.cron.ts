import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../platform/common/app-logger';
import { runInJobContext } from '../../platform/common/job-context';
import { Interval } from '@nestjs/schedule';
import { GalleryMediaMigrationService } from './gallery-media-migration.service';

/**
 * 广场作品媒体迁移定时 worker：每分钟捞一批 mediaMigrated=false 的作品迁移到 R2。
 * 独立于导入请求运行，进程重启也能下轮续跑；用 running 标记避免上一轮未完成时重叠执行。
 */
@Injectable()
export class GalleryMediaMigrationCron {
  private readonly logger = new AppLogger(GalleryMediaMigrationCron.name);
  private running = false;

  constructor(private readonly service: GalleryMediaMigrationService) {}

  @Interval(60_000)
  async tick() {
    return runInJobContext({ name: 'creation.galleryMediaMigration', logger: this.logger }, async () => {
      if (this.running) return;
      this.running = true;
      try {
        const res = await this.service.migratePendingBatch();
        if (res.scanned > 0) {
          this.logger.log(
            `tick: scanned=${res.scanned} published=${res.published} retry=${res.retry} stranded=${res.stranded}`,
          );
        }
      } catch (err) {
        return { failed: true as const, error: err };
      } finally {
        this.running = false;
      }
    });
  }
}
