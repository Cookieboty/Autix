import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ResourceType, TemplateStatus } from '../prisma/generated';
import { PrismaService } from '../prisma/prisma.service';
import { SseService, type TaskEventPayload } from '../sse/sse.service';
import { ResourceMigrationService } from './resource-migration.service';

export type BatchJobType = 'IMPORT' | 'APPROVE' | 'REJECT' | 'REVISE' | 'DELETE';

export interface BatchJobResult {
  jobId: string;
}

interface BatchJobParams {
  items?: Record<string, any>[];
  ids?: string[];
  action?: string;
  reason?: string;
}

@Injectable()
export class BatchJobService {
  private readonly logger = new Logger(BatchJobService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sse: SseService,
    private readonly migration: ResourceMigrationService,
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
    const job = await this.prisma.batch_jobs.create({
      data: {
        userId,
        type,
        resourceType,
        status: 'pending',
        total: params.items?.length ?? params.ids?.length ?? 0,
        metadata: params as any,
      },
    });

    void this.processJob(job.id, type, resourceType, userId, params).catch(
      (err) => {
        this.logger.error(`Batch job ${job.id} failed: ${err.message}`);
      },
    );

    return { jobId: job.id };
  }

  async getJob(jobId: string) {
    return this.prisma.batch_jobs.findUnique({ where: { id: jobId } });
  }

  async listJobs(userId: string, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.prisma.batch_jobs.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.batch_jobs.count({ where: { userId } }),
    ]);
    return { items, total, page, pageSize };
  }

  // ── Private processing ──────────────────────────────────────────────

  private async processJob(
    jobId: string,
    type: BatchJobType,
    resourceType: ResourceType,
    userId: string,
    params: BatchJobParams,
  ): Promise<void> {
    await this.prisma.batch_jobs.update({
      where: { id: jobId },
      data: { status: 'processing' },
    });

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

      await this.prisma.batch_jobs.update({
        where: { id: jobId },
        data: { status: 'done', completedAt: new Date() },
      });
    } catch (err: any) {
      this.logger.error(`Batch job ${jobId} processing error: ${err.message}`);
      await this.prisma.batch_jobs.update({
        where: { id: jobId },
        data: { status: 'error', completedAt: new Date() },
      });
    }

    const job = await this.prisma.batch_jobs.findUnique({ where: { id: jobId } });
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

  private delegateFor(resourceType: ResourceType) {
    return (
      resourceType === ResourceType.IMAGE_TEMPLATE
        ? this.prisma.image_templates
        : this.prisma.video_templates
    ) as any;
  }

  private async processImport(
    jobId: string,
    resourceType: ResourceType,
    userId: string,
    items: Record<string, any>[],
  ): Promise<void> {
    let processed = 0;
    let failed = 0;
    const errors: Array<{ index: number; error: string }> = [];
    const delegate = this.delegateFor(resourceType);

    for (let i = 0; i < items.length; i++) {
      try {
        const item = items[i];
        const folder = `batch-import/${jobId}/${i}`;

        const { data, errors: migrateErrors } =
          await this.migration.migrateMediaFields(item, folder);

        await delegate.create({
          data: {
            ...data,
            status: TemplateStatus.PENDING,
            authorId: userId,
            variables: data.variables ?? {},
            tags: data.tags ?? [],
            pointsCost: data.pointsCost ?? 0,
          },
        });

        processed++;
        if (migrateErrors.length > 0) {
          errors.push({ index: i, error: migrateErrors.join('; ') });
        }
      } catch (err: any) {
        failed++;
        errors.push({ index: i, error: err.message });
      }
    }

    await this.prisma.batch_jobs.update({
      where: { id: jobId },
      data: { processed, failed, errorLog: errors.length > 0 ? errors : undefined },
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
    const delegate = this.delegateFor(resourceType);

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
        await delegate.update({ where: { id }, data });
        processed++;
      } catch (err: any) {
        failed++;
        errors.push({ id, error: err.message });
      }
    }

    await this.prisma.batch_jobs.update({
      where: { id: jobId },
      data: { processed, failed, errorLog: errors.length > 0 ? errors : undefined },
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
    const delegate = this.delegateFor(resourceType);

    for (const id of ids) {
      try {
        await delegate.delete({ where: { id } });
        processed++;
      } catch (err: any) {
        failed++;
        errors.push({ id, error: err.message });
      }
    }

    await this.prisma.batch_jobs.update({
      where: { id: jobId },
      data: { processed, failed, errorLog: errors.length > 0 ? errors : undefined },
    });
  }
}
