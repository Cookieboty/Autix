import { Injectable } from '@nestjs/common';
import {
  GenerationBillingStatus,
  GenerationTaskStatus,
  type GenerationKind,
  type Prisma,
} from '../prisma/generated';
import { AppLogger } from '../common/app-logger';
import { sanitizeSnapshot } from '../common/snapshot-sanitizer';
import type { GenerationFailure } from './generation-failure';
import { GenerationTaskRepository } from './generation-task.repository';

export interface StartGenerationTaskInput {
  id: string;
  kind: GenerationKind;
  userId: string;
  model: string;
  modelConfigId?: string | null;
  provider?: string | null;
  protocolKey?: string | null;
  prompt?: string | null;
  paramsSnapshot?: unknown;
  materialCount?: number;
  holdId?: string | null;
  /**
   * 视频生成的反向指针，透传给 GenerationTaskRepository.create。视频任务对应的
   * video_clip_generations 行在 start 时就已存在，故此处在创建时就写；见
   * CreateGenerationTaskInput.videoGenerationId 的说明。recorder 是 generation_tasks
   * 的唯一写入口，若不透传该字段，视频侧将被迫绕开 recorder 直连 repository。
   */
  videoGenerationId?: string | null;
}

/**
 * 生成任务的唯一写入口。
 *
 * 关键约束（见 spec §5.6）：`start` **不是** best-effort。终态写入是两张表同事务 CAS，
 * 若 start 写失败但业务继续，终态时 generation_tasks 缺行 → updateMany 命中 0 行 →
 * CAS 判负 → 反而阻塞生成收敛。任务行是生成流程的前置条件。
 */
@Injectable()
export class GenerationTaskRecorder {
  private readonly logger = new AppLogger(GenerationTaskRecorder.name);

  constructor(private readonly repository: GenerationTaskRepository) {}

  /** 失败即抛 —— 调用方必须中止生成。 */
  async start(input: StartGenerationTaskInput, tx?: Prisma.TransactionClient): Promise<void> {
    await this.repository.create(
      {
        id: input.id,
        kind: input.kind,
        userId: input.userId,
        model: input.model,
        modelConfigId: input.modelConfigId,
        provider: input.provider,
        protocolKey: input.protocolKey,
        prompt: input.prompt,
        promptLength: input.prompt?.length ?? 0,
        paramsSnapshot: sanitizeSnapshot(input.paramsSnapshot) as Prisma.InputJsonValue,
        materialCount: input.materialCount,
        holdId: input.holdId,
        videoGenerationId: input.videoGenerationId,
      },
      tx,
    );
  }

  async queued(id: string, providerTaskId: string, tx?: Prisma.TransactionClient): Promise<void> {
    await this.repository.markQueued(id, providerTaskId, tx);
  }

  /** 返回是否抢到终态；false 时调用方必须放弃整个事务。 */
  async succeed(
    id: string,
    result: { imageGenerationId?: string; durationMs?: number },
    tx: Prisma.TransactionClient,
  ): Promise<boolean> {
    return this.repository.claimTerminal(
      id,
      {
        status: GenerationTaskStatus.SUCCEEDED,
        imageGenerationId: result.imageGenerationId,
        durationMs: result.durationMs,
      },
      tx,
    );
  }

  async fail(
    id: string,
    failure: GenerationFailure,
    tx: Prisma.TransactionClient,
    status: GenerationTaskStatus = GenerationTaskStatus.FAILED,
  ): Promise<boolean> {
    return this.repository.claimTerminal(
      id,
      {
        status,
        errorStage: failure.stage,
        errorClass: failure.class,
        errorCode: failure.code,
        errorMessage: failure.message,
        upstreamStatus: failure.upstreamStatus,
        upstreamBody: failure.upstreamBody,
        upstreamRequestId: failure.upstreamRequestId,
      },
      tx,
    );
  }

  /** 计费记录与主失败正交，独立于主事务；失败只 log 不抛。 */
  async recordBilling(id: string, status: GenerationBillingStatus, error?: string): Promise<void> {
    try {
      await this.repository.recordBilling(id, status, error);
    } catch (err) {
      this.logger.error(
        `record billing failed: task=${id} status=${status}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /** 迟到回调只记录不改状态；失败只 log 不抛。 */
  async recordLateCallback(id: string, outcome: string): Promise<void> {
    try {
      await this.repository.recordLateCallback(id, outcome);
    } catch (err) {
      this.logger.error(
        `record late callback failed: task=${id}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
