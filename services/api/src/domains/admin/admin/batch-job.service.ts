import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma, ResourceType, TemplateStatus } from '../../platform/prisma/generated';
import { SseService, type TaskEventPayload } from '../../platform/sse/sse.service';
import { BatchJobRepository } from './batch-job.repository';

export type BatchJobType = 'APPROVE' | 'REJECT' | 'REVISE' | 'DELETE';

export interface BatchJobResult {
  jobId: string;
}

interface BatchJobParams {
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

  constructor(
    private readonly repository: BatchJobRepository,
    private readonly sse: SseService,
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
      total: params.ids?.length ?? 0,
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
