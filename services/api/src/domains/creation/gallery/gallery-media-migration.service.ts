import { Injectable, Logger } from '@nestjs/common';
import { ResourceMigrationService } from '../../admin/admin/resource-migration.service';
import { GalleryRepository } from './gallery.repository';
import { runWithConcurrency } from './run-with-concurrency';

/** 广场作品导入后需要迁移到 R2 的媒体字段（区别于模板的 exampleImages/exampleMedia）。 */
const GALLERY_MEDIA_FIELDS = ['coverImage', 'mediaUrls'] as const;

// 只尝试一次：迁移失败（多为源站不可达/被墙的连接级错误，重试无意义）即放弃止损，保留原始外链。
const DEFAULT_MAX_ATTEMPTS = 1;
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_CONCURRENCY = 5;

export type MigrateBatchOptions = {
  maxAttempts?: number;
  batchSize?: number;
  concurrency?: number;
};

export type MigrateBatchResult = {
  /** 本轮取到的待迁移作品数 */
  scanned: number;
  /** 本轮已了结（成功迁移或达上限止损）的作品数 */
  settled: number;
  /** 本轮失败但未达上限、留待下轮重试的作品数 */
  retry: number;
};

/**
 * 广场作品媒体异步迁移 worker 的核心逻辑（被 GalleryMediaMigrationCron 定时调用）。
 * 把导入时先落库的原始外链下载并重传到 R2，成功后回写新链接并标记 mediaMigrated=true；
 * 失败自增尝试次数，达到上限后止损（不再重试死链，保留原始外链）。幂等、可断点续跑、进程重启不丢。
 */
@Injectable()
export class GalleryMediaMigrationService {
  private readonly logger = new Logger(GalleryMediaMigrationService.name);

  constructor(
    private readonly repo: GalleryRepository,
    private readonly migration: ResourceMigrationService,
  ) {}

  async migratePendingBatch(options: MigrateBatchOptions = {}): Promise<MigrateBatchResult> {
    const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;

    const posts = await this.repo.findPostsPendingMediaMigration(maxAttempts, batchSize);
    if (posts.length === 0) return { scanned: 0, settled: 0, retry: 0 };

    let settled = 0;
    let retry = 0;

    await runWithConcurrency(posts, concurrency, async (post) => {
      const nextAttempts = post.mediaMigrationAttempts + 1;
      const { data, errors } = await this.migration.migrateMediaFields(
        { coverImage: post.coverImage, mediaUrls: post.mediaUrls },
        `gallery/${post.id}`,
        GALLERY_MEDIA_FIELDS,
      );

      // migrateMediaFields 内部会逐链接吞错：成功的替换为 R2 链接，失败的保留原始外链。
      const succeeded = errors.length === 0;
      const giveUp = !succeeded && nextAttempts >= maxAttempts;
      const migrated = succeeded || giveUp;

      await this.repo.update(post.id, {
        coverImage: (data.coverImage as string | null) ?? post.coverImage,
        mediaUrls: (data.mediaUrls as string[]) ?? post.mediaUrls,
        mediaMigrated: migrated,
        mediaMigrationAttempts: nextAttempts,
      });

      if (migrated) {
        settled++;
        if (giveUp) {
          this.logger.warn(
            `gallery post ${post.id} media migration gave up after ${nextAttempts} attempts: ${errors.join('; ')}`,
          );
        }
      } else {
        retry++;
      }
    });

    this.logger.log(
      `gallery media migration batch: scanned=${posts.length} settled=${settled} retry=${retry}`,
    );
    return { scanned: posts.length, settled, retry };
  }
}
