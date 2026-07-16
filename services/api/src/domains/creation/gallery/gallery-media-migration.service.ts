import { Injectable, Logger } from '@nestjs/common';
import { ResourceMigrationService } from '../../admin/admin/resource-migration.service';
import { GalleryRepository } from './gallery.repository';
import { runWithConcurrency } from './run-with-concurrency';

/** 广场作品导入后需要迁移到 R2 的媒体字段（区别于模板的 exampleImages/exampleMedia）。 */
const GALLERY_MEDIA_FIELDS = ['coverImage', 'mediaUrls'] as const;

// 搬不动的作品会滞留 PENDING 不发布，代价远高于旧设计（旧设计放弃=带外链继续发布），
// 故给瞬时故障（503/超时）留重试余地。达上限后由 findPostsPendingMediaMigration 的
// attempts < maxAttempts 条件自然掉出队列。
const DEFAULT_MAX_ATTEMPTS = 3;
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
  /** 本轮媒体全部站内化并成功发布的作品数 */
  published: number;
  /** 本轮失败但未达上限、留待下轮重试的作品数 */
  retry: number;
  /** 本轮失败且已达上限、滞留 PENDING 待人工处置的作品数 */
  stranded: number;
};

/**
 * 广场作品媒体异步迁移 worker 的核心逻辑（被 GalleryMediaMigrationCron 定时调用）。
 * 把导入时先落库的原始外链下载并重传到 R2；**全部媒体搬成功**才回写 mediaMigrated=true
 * 并把作品由 PENDING 发布。任一媒体失败即不发布（避免带死链上线），自增尝试次数等下轮；
 * 达上限后掉出队列、滞留 PENDING 供人工处置。幂等、可断点续跑、进程重启不丢。
 *
 * mediaMigrated 的语义是"所有媒体已站内化"这一**数据事实**，不是任务状态 ——
 * 失败一律保持 false，"不再重试"由 mediaMigrationAttempts >= maxAttempts 表达。
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
    if (posts.length === 0) return { scanned: 0, published: 0, retry: 0, stranded: 0 };

    let published = 0;
    let retry = 0;
    let stranded = 0;

    await runWithConcurrency(posts, concurrency, async (post) => {
      const nextAttempts = post.mediaMigrationAttempts + 1;
      const { data, errors } = await this.migration.migrateMediaFields(
        { coverImage: post.coverImage, mediaUrls: post.mediaUrls },
        `gallery/${post.id}`,
        GALLERY_MEDIA_FIELDS,
      );

      // migrateMediaFields 内部逐链接吞错：成功的替换为 R2 链接，失败的保留原始外链。
      // 故部分成功时回写仍有意义（保留进度，下轮只补剩余；已站内的会被跳过）。
      const succeeded = errors.length === 0;

      await this.repo.update(post.id, {
        coverImage: (data.coverImage as string | null) ?? post.coverImage,
        mediaUrls: (data.mediaUrls as string[]) ?? post.mediaUrls,
        mediaMigrated: succeeded,
        mediaMigrationAttempts: nextAttempts,
      });

      if (succeeded) {
        // 仅当作品仍为 PENDING 才发布；管理员若已抢先处置，count=0，不覆盖其决定。
        const count = await this.repo.publishIfPending(post.id);
        if (count > 0) published++;
        return;
      }

      if (nextAttempts >= maxAttempts) {
        stranded++;
        this.logger.warn(
          `gallery post ${post.id} media migration stranded after ${nextAttempts} attempts, stays PENDING: ${errors.join('; ')}`,
        );
      } else {
        retry++;
      }
    });

    this.logger.log(
      `gallery media migration batch: scanned=${posts.length} published=${published} retry=${retry} stranded=${stranded}`,
    );
    return { scanned: posts.length, published, retry, stranded };
  }
}
