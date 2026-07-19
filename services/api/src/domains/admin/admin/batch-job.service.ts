import { BadRequestException, Injectable } from '@nestjs/common';
import { AppLogger } from '../../platform/common/app-logger';
import { randomUUID } from 'crypto';
import { assertSource, type GallerySourcePayload } from '../../creation/gallery/gallery.helpers';
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
import { BatchJobRepository } from './batch-job.repository';

export type BatchJobType = 'IMPORT' | 'APPROVE' | 'REJECT' | 'REVISE' | 'DELETE';

export interface BatchJobResult {
  jobId: string;
}

interface BatchJobParams {
  ids?: string[];
  action?: string;
  reason?: string;
  items?: Record<string, unknown>[];
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

/**
 * Fix 2：`?? null` 只拦 null/undefined，不拦 `''`。GALLERY_IMPORT_TEMPLATE 里
 * coverImage/title/aspectRatio 默认值就是 `''`，管理员下载模板直接填 mediaUrls
 * 保留其余字段为空，是最正常的操作路径——不能让它落成非 null 的空串（会让
 * `item.coverImage ?? item.mediaUrls[0]` 之类的回退失效）。纯空白同样归一。
 */
function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}

const GALLERY_KINDS = new Set(['IMAGE', 'VIDEO']);

/**
 * 广场 feed 按 publishedAt 排序，但 createdAt 也会外露在管理端列表/详情。导入一批的
 * createdAt 全落在导入那一刻（schema `@default(now())`），几十条挤在同一秒一眼假。
 * 显式写 createdAt = now - random(0, 7天)，让它们看起来像过去一周内陆续投稿。
 * publishedAt 不在这里算——由 worker 搬运成功后另行计算（见 gallery-media-migration.service.ts），
 * 避免 stranded 的作品带着一个它从未拥有过的发布时间。
 */
const CREATED_AT_MAX_PAST_MS = 7 * 24 * 60 * 60 * 1000; // 7 天

function randomPastCreatedAt(): Date {
  return new Date(Date.now() - Math.random() * CREATED_AT_MAX_PAST_MS);
}

@Injectable()
export class BatchJobService {
  private readonly logger = new AppLogger(BatchJobService.name);

  /**
   * 导入 JSON 的字段白名单：只有这些字段会落库。
   * authorId/status/sourceType/mediaMigrated 由服务端强制指定，
   * 不接受 JSON 夹带（否则可伪造归属或跳过审核直接发布）。
   */
  private static readonly GALLERY_FIELDS = new Set([
    'kind',
    'title',
    'description',
    'category',
    'tags',
    'coverImage',
    'mediaUrls',
    'aspectRatio',
    'durationSec',
  ]);

  constructor(
    private readonly repository: BatchJobRepository,
    private readonly sse: SseService,
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

  /**
   * 广场作品导入直接落 gallery_posts 表（不经 GalleryService）：GalleryModule 已依赖
   * AdminModule 取 BatchJobService，反向依赖会构成 DI 循环。字段校验由 assertSource 承担。
   * 媒体不在此搬运 —— 落 mediaMigrated=false 交给 GalleryMediaMigrationCron 异步处理。
   */
  private async createGalleryPost(userId: string, data: Record<string, unknown>) {
    // 缺失/非法 kind 此前被 `?? GalleryKind.IMAGE` 静默默认为 IMAGE——一条视频误标
    // 成图片会悄悄发布。同函数内顺手修：计入 failed 而非静默默认（见 final-fixes 审查）。
    if (!GALLERY_KINDS.has(data.kind as string)) {
      throw new BadRequestException(`导入项缺失或非法的 kind: ${String(data.kind)}`);
    }
    return this.prisma.gallery_posts.create({
      data: {
        kind: data.kind as GalleryKind,
        title: str(data.title),
        description: str(data.description),
        // category 与 CreateGalleryPostDto/UpdateGalleryPostDto 的既有设计一致：
        // "可选：不再要求作者选分类……空缺时落 ''，由审核员在管理端补"（gallery.service.ts）。
        // ADMIN_CURATED 导入沿用同一约定，不额外要求非空，也不落 null（category 是必填非空 String 列）。
        category: (data.category as string) ?? '',
        tags: (data.tags as string[]) ?? [],
        coverImage: str(data.coverImage),
        mediaUrls: (data.mediaUrls as string[]) ?? [],
        aspectRatio: str(data.aspectRatio),
        durationSec: (data.durationSec as number) ?? null,
        authorId: userId,
        sourceType: GallerySource.ADMIN_CURATED,
        status: GalleryStatus.PENDING,
        mediaMigrated: false,
        mediaMigrationAttempts: 0,
        createdAt: randomPastCreatedAt(),
      },
    });
  }

  private async processImport(
    jobId: string,
    resourceType: ResourceType,
    userId: string,
    items: Record<string, unknown>[],
  ): Promise<void> {
    let processed = 0;
    let failed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const [index, item] of items.entries()) {
      try {
        if (resourceType !== ResourceType.GALLERY_POST) {
          throw new Error(`IMPORT 暂不支持资源类型: ${resourceType}`);
        }
        const filtered: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(item)) {
          if (BatchJobService.GALLERY_FIELDS.has(key)) filtered[key] = value;
        }
        assertSource(
          { ...filtered, sourceType: 'ADMIN_CURATED' } as unknown as GallerySourcePayload,
          'admin',
        );
        await this.createGalleryPost(userId, filtered);
        processed++;
      } catch (err: unknown) {
        failed++;
        errors.push({
          id: `item[${index}]`,
          error: errorDetails(err).message ?? String(err),
        });
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
