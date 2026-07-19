import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../platform/common/app-logger';
import { ResourceMigrationService } from '../../admin/admin/resource-migration.service';
import { GalleryRepository } from './gallery.repository';
import { runWithConcurrency } from './run-with-concurrency';
import { GALLERY_MEDIA_MIGRATION_MAX_ATTEMPTS } from './gallery.helpers';

/** 广场作品导入后需要迁移到 R2 的媒体字段（区别于模板的 exampleImages/exampleMedia）。 */
const GALLERY_MEDIA_FIELDS = ['coverImage', 'mediaUrls'] as const;

// 搬不动的作品会滞留 PENDING 不发布，代价远高于旧设计（旧设计放弃=带外链继续发布），
// 故给瞬时故障（503/超时）留重试余地。达上限后由 findPostsPendingMediaMigration 的
// attempts < maxAttempts 条件自然掉出队列。
// 上限值定义在 gallery.helpers.ts（管理端"搬运失败"筛选与本 worker 共用同一常量，避免两处静默错位）。
const DEFAULT_MAX_ATTEMPTS = GALLERY_MEDIA_MIGRATION_MAX_ATTEMPTS;
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_CONCURRENCY = 5;

// 广场 feed 按 publishedAt 排序；导入批次的 createdAt 已经撒开了（见 batch-job.service.ts），
// 发布时间再叠一层随机偏移，让"投稿→过审"的间隔看起来自然。
const MIN_PUBLISH_OFFSET_MS = 5 * 60 * 1000; // 5 分钟
const MAX_PUBLISH_OFFSET_MS = 6 * 60 * 60 * 1000; // 6 小时

/**
 * publishedAt = min(createdAt + random(5分钟, 6小时), now)。
 * 必须夹住 now：createdAt 是随机过去时间，可能极近（如 1 分钟前）；不夹住的话
 * 「createdAt + 大偏移」会产生未来的 publishedAt —— 那条作品会永远钉在 feed 顶部
 * 并显示"N 小时后发布"。
 */
function randomPublishedAt(createdAt: Date): Date {
  const offset = MIN_PUBLISH_OFFSET_MS + Math.random() * (MAX_PUBLISH_OFFSET_MS - MIN_PUBLISH_OFFSET_MS);
  return new Date(Math.min(createdAt.getTime() + offset, Date.now()));
}

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
  private readonly logger = new AppLogger(GalleryMediaMigrationService.name);

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
        const count = await this.repo.publishIfPending(post.id, randomPublishedAt(post.createdAt));
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
