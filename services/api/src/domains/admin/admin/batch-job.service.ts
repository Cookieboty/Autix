import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  GalleryKind,
  GallerySource,
  GalleryStatus,
  Prisma,
  ResourceType,
  TemplateStatus,
} from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { SseService, type TaskEventPayload } from '../../platform/sse/sse.service';
import { ResourceMigrationService, type ResourcePayload } from './resource-migration.service';
import { mapGalleryImportItem, type MappedGalleryImport } from './gallery-import.mapper';
import { BatchJobRepository } from './batch-job.repository';

export type BatchJobType = 'IMPORT' | 'APPROVE' | 'REJECT' | 'REVISE' | 'DELETE';

export interface BatchJobResult {
  jobId: string;
}

interface BatchJobParams {
  items?: ResourcePayload[];
  ids?: string[];
  action?: string;
  reason?: string;
}

type UnknownError = {
  message?: string;
  code?: string;
  meta?: unknown;
};

function errorDetails(error: unknown): UnknownError {
  if (error && typeof error === 'object') return error as UnknownError;
  return { message: String(error) };
}

@Injectable()
export class BatchJobService {
  private readonly logger = new Logger(BatchJobService.name);
  private static readonly RANDOM_PUBLISHED_AT_WINDOW_DAYS = 7;
  private static readonly DAY_MS = 24 * 60 * 60 * 1000;

  constructor(
    private readonly repository: BatchJobRepository,
    private readonly sse: SseService,
    private readonly migration: ResourceMigrationService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Persist a batch job then process it asynchronously (fire-and-forget).
   */
  async createAndProcess(
    userId: string,
    type: BatchJobType,
    resourceType: ResourceType,
    params: BatchJobParams,
  ): Promise<BatchJobResult> {
    const job = await this.repository.createJob({
      userId,
      type,
      resourceType,
      status: 'pending',
      total: params.items?.length ?? params.ids?.length ?? 0,
      metadata: params as unknown as Prisma.InputJsonValue,
    });

    void this.processJob(job.id, type, resourceType, userId, params).catch(
      (err: unknown) => {
        this.logger.error(`Batch job ${job.id} failed: ${errorDetails(err).message}`);
      },
    );

    return { jobId: job.id };
  }

  async getJob(jobId: string) {
    return this.repository.findJob(jobId);
  }

  async listJobs(userId: string, page = 1, pageSize = 20) {
    return this.repository.listJobs(userId, page, pageSize);
  }

  // ── Private processing ──────────────────────────────────────────────

  private async processJob(
    jobId: string,
    type: BatchJobType,
    resourceType: ResourceType,
    userId: string,
    params: BatchJobParams,
  ): Promise<void> {
    await this.repository.updateJob(jobId, { status: 'processing' });

    try {
      switch (type) {
        case 'IMPORT':
          await this.processImport(jobId, resourceType, userId, params.items ?? []);
          break;
        case 'APPROVE':
        case 'REJECT':
        case 'REVISE':
          await this.processBatchReview(
            jobId,
            resourceType,
            params.ids ?? [],
            params.action ?? type.toLowerCase(),
            params.reason,
          );
          break;
        case 'DELETE':
          await this.processBatchDelete(jobId, resourceType, params.ids ?? []);
          break;
      }

      await this.repository.updateJob(jobId, { status: 'done', completedAt: new Date() });
    } catch (err: unknown) {
      this.logger.error(`Batch job ${jobId} processing error: ${errorDetails(err).message}`);
      await this.repository.updateJob(jobId, { status: 'error', completedAt: new Date() });
    }

    const job = await this.repository.findJob(jobId);
    if (job) {
      await this.sse
        .emit(userId, {
          id: randomUUID(),
          taskType: 'batch_job',
          taskId: jobId,
          status: job.status as TaskEventPayload['status'],
          message: `${type} completed: ${job.processed} processed, ${job.failed} failed`,
          metadata: {
            jobId,
            type,
            resourceType,
            total: job.total,
            processed: job.processed,
            failed: job.failed,
          },
          createdAt: new Date().toISOString(),
        })
        .catch(() => undefined);
    }
  }

  private static readonly IMAGE_FIELDS = new Set([
    'title', 'description', 'category', 'prompt', 'variables',
    'coverImage', 'exampleImages', 'modelHint', 'tags', 'pointsCost',
    'originalUrl', 'authorName', 'authorUrl', 'sourcePlatform',
    'externalId', 'externalSlug', 'externalMetadata',
  ]);

  private static readonly VIDEO_FIELDS = new Set([
    'title', 'description', 'category', 'prompt', 'variables',
    'coverImage', 'exampleMedia', 'modelHint', 'durationSec',
    'defaultParams', 'materialSlots', 'tags', 'pointsCost',
    'originalUrl', 'authorName', 'authorUrl', 'sourcePlatform',
    'externalId', 'externalSlug', 'externalMetadata',
  ]);

  private static readonly GALLERY_FIELDS = new Set([
    'kind', 'title', 'description', 'category', 'tags',
    'coverImage', 'mediaUrls', 'aspectRatio', 'durationSec',
  ]);

  private pickAllowedFields(
    data: ResourcePayload,
    resourceType: ResourceType,
  ): ResourcePayload {
    const allowed =
      resourceType === ResourceType.IMAGE_TEMPLATE
        ? BatchJobService.IMAGE_FIELDS
        : resourceType === ResourceType.GALLERY_POST
          ? BatchJobService.GALLERY_FIELDS
          : BatchJobService.VIDEO_FIELDS;
    const result: ResourcePayload = {};
    for (const [key, value] of Object.entries(data)) {
      if (allowed.has(key)) result[key] = value;
    }
    return result;
  }

  /**
   * 广场作品导入直接落 gallery_posts 表（不经过 marketplace 的 repository.delegateFor，
   * 后者只认识 image_templates/video_templates）。管理员导入的作品视为运营精选，直接发布。
   * 发布人固定为当前上传的管理员（authorId + authorSnapshot），不从导入文件取作者。
   */
  private async createGalleryPost(
    userId: string,
    data: MappedGalleryImport,
    authorSnapshot: Prisma.InputJsonValue | null,
  ) {
    return this.prisma.gallery_posts.create({
      data: {
        kind: data.kind as GalleryKind,
        // 广场不要标题
        title: null,
        description: null,
        category: data.category,
        tags: [],
        coverImage: data.coverImage,
        mediaUrls: data.mediaUrls,
        aspectRatio: data.aspectRatio,
        prompt: data.prompt,
        model: data.model,
        width: data.width,
        height: data.height,
        sourceType: GallerySource.ADMIN_CURATED,
        status: GalleryStatus.PUBLISHED,
        publishedAt: this.randomGalleryPublishedAtWithinLast7Days(),
        authorId: userId,
        ...(authorSnapshot ? { authorSnapshot } : {}),
        // 先落原始外链，等待后台 worker 迁移到 R2（见 GalleryMediaMigrationCron）。
        mediaMigrated: false,
        mediaMigrationAttempts: 0,
      },
    });
  }

  /**
   * 用当前上传用户的信息构造广场作者快照（发布人 = 上传者，不取自导入文件）。
   * 整批导入作者相同，故只查一次。
   */
  private async buildGalleryAuthorSnapshot(
    userId: string,
  ): Promise<Prisma.InputJsonValue | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, realName: true, avatar: true },
    });
    if (!user) return null;
    const snapshot: { displayName: string; avatarUrl?: string; at: string } = {
      displayName: user.realName?.trim() || user.username,
      at: new Date().toISOString(),
    };
    if (user.avatar) snapshot.avatarUrl = user.avatar;
    return snapshot;
  }

  private randomGalleryPublishedAtWithinLast7Days(): Date {
    const windowMs =
      BatchJobService.RANDOM_PUBLISHED_AT_WINDOW_DAYS * BatchJobService.DAY_MS;
    return new Date(Date.now() - Math.random() * windowMs);
  }

  private async processImport(
    jobId: string,
    resourceType: ResourceType,
    userId: string,
    items: ResourcePayload[],
  ): Promise<void> {
    let processed = 0;
    let failed = 0;
    const errors: Array<{ index: number; error: string }> = [];

    // 发布人固定为当前上传用户：整批作者相同，导入前查一次快照，不从导入文件取作者。
    const galleryAuthorSnapshot =
      resourceType === ResourceType.GALLERY_POST
        ? await this.buildGalleryAuthorSnapshot(userId)
        : null;

    for (let i = 0; i < items.length; i++) {
      try {
        const item = items[i];

        // 广场作品：快速入库。按 data.json 形态只抽取需要的字段（image_url/prompt/model/width/height，
        // 丢标题），先落原始外链（mediaMigrated=false），媒体迁移交给后台 worker 异步跑。
        if (resourceType === ResourceType.GALLERY_POST) {
          const mapped = mapGalleryImportItem(item);
          await this.createGalleryPost(userId, mapped, galleryAuthorSnapshot);
          processed++;
          this.logger.log(`[Import ${jobId}] item[${i}] ✓ queued (gallery, media pending)`);
          continue;
        }

        const folder = `batch-import/${jobId}/${i}`;

        this.logger.log(
          `[Import ${jobId}] item[${i}] "${String(item.title ?? '')}" — starting migration`,
        );

        const { data, errors: migrateErrors } =
          await this.migration.migrateMediaFields(item, folder);

        if (migrateErrors.length > 0) {
          this.logger.warn(
            `[Import ${jobId}] item[${i}] migration warnings: ${migrateErrors.join('; ')}`,
          );
        }

        const filtered = this.pickAllowedFields(data, resourceType);

        {
          const existing = filtered.externalId && filtered.sourcePlatform
            ? await this.repository.findImportedResource(
                resourceType,
                filtered.externalId,
                filtered.sourcePlatform,
              )
            : null;

          if (existing) {
            await this.repository.updateResource(resourceType, existing.id, filtered);
            this.logger.log(
              `[Import ${jobId}] item[${i}] ✓ updated existing (id=${existing.id})`,
            );
          } else {
            await this.repository.createImportedResource(resourceType, userId, filtered);
            this.logger.log(`[Import ${jobId}] item[${i}] ✓ created successfully`);
          }
        }

        processed++;
        if (migrateErrors.length > 0) {
          errors.push({ index: i, error: migrateErrors.join('; ') });
        }
      } catch (err: unknown) {
        const details = errorDetails(err);
        failed++;
        this.logger.error(
          `[Import ${jobId}] item[${i}] ✗ FAILED: ${details.message}`,
        );
        if (details.code) {
          this.logger.error(`[Import ${jobId}] item[${i}] Prisma code: ${details.code}`);
        }
        if (details.meta) {
          this.logger.error(
            `[Import ${jobId}] item[${i}] meta: ${JSON.stringify(details.meta)}`,
          );
        }
        errors.push({ index: i, error: details.message ?? String(err) });
      }
    }

    await this.repository.updateJob(jobId, {
      processed,
      failed,
      errorLog: errors.length > 0 ? errors : undefined,
    });
  }

  private async processBatchReview(
    jobId: string,
    resourceType: ResourceType,
    ids: string[],
    action: string,
    reason?: string,
  ): Promise<void> {
    let processed = 0;
    let failed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const id of ids) {
      try {
        const data: Record<string, unknown> = {};
        switch (action) {
          case 'approve':
            data.status = TemplateStatus.APPROVED;
            data.publishedAt = new Date();
            data.rejectReason = null;
            break;
          case 'reject':
            data.status = TemplateStatus.REJECTED;
            data.rejectReason = reason ?? null;
            break;
          case 'revise':
            data.status = TemplateStatus.PENDING;
            data.rejectReason = reason ?? null;
            break;
          default:
            throw new Error(`Unknown review action: ${action}`);
        }
        await this.repository.updateResource(resourceType, id, data);
        processed++;
      } catch (err: unknown) {
        failed++;
        errors.push({ id, error: errorDetails(err).message ?? String(err) });
      }
    }

    await this.repository.updateJob(jobId, {
      processed,
      failed,
      errorLog: errors.length > 0 ? errors : undefined,
    });
  }

  private async processBatchDelete(
    jobId: string,
    resourceType: ResourceType,
    ids: string[],
  ): Promise<void> {
    let processed = 0;
    let failed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const id of ids) {
      try {
        await this.repository.deleteResource(resourceType, id);
        processed++;
      } catch (err: unknown) {
        failed++;
        errors.push({ id, error: errorDetails(err).message ?? String(err) });
      }
    }

    await this.repository.updateJob(jobId, {
      processed,
      failed,
      errorLog: errors.length > 0 ? errors : undefined,
    });
  }
}
