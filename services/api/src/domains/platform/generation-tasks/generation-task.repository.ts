import { Injectable } from '@nestjs/common';
import {
  GenerationBillingStatus,
  GenerationTaskStatus,
  Prisma,
  type GenerationErrorStage,
  type GenerationKind,
} from '../prisma/generated';
import { AppLogger } from '../common/app-logger';
import { PrismaService } from '../prisma/prisma.service';

/** 唯一允许迁出的状态。终态不可变 —— 不含任何终态值，`EXPIRED → SUCCEEDED` 亦被拒。 */
const CLAIMABLE_FROM: GenerationTaskStatus[] = [
  GenerationTaskStatus.PENDING,
  GenerationTaskStatus.QUEUED,
];

export interface CreateGenerationTaskInput {
  id: string;
  kind: GenerationKind;
  userId: string;
  model: string;
  modelConfigId?: string | null;
  provider?: string | null;
  protocolKey?: string | null;
  prompt?: string | null;
  promptLength: number;
  paramsSnapshot?: Prisma.InputJsonValue;
  materialCount?: number;
  holdId?: string | null;
  submittedAt?: Date;
  /**
   * 视频生成的反向指针。视频任务对应的 `video_clip_generations` 行在任务 start 时
   * 就已存在，所以这里在 create 时写；与之相对，图片的 `imageGenerationId` 只在
   * 成功终态时才写（见 `TerminalUpdate.imageGenerationId`），因为对应行只在成功后才建。
   */
  videoGenerationId?: string | null;
}

export interface TerminalUpdate {
  status: GenerationTaskStatus;
  errorStage?: GenerationErrorStage;
  errorClass?: string;
  errorCode?: string;
  errorMessage?: string;
  upstreamStatus?: number;
  upstreamBody?: string;
  upstreamRequestId?: string;
  upstreamDiagnostics?: Prisma.InputJsonValue;
  imageGenerationId?: string;
  durationMs?: number;
}

@Injectable()
export class GenerationTaskRepository {
  private readonly logger = new AppLogger(GenerationTaskRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Prisma.TransactionClient) {
    return tx ?? this.prisma;
  }

  async create(input: CreateGenerationTaskInput, tx?: Prisma.TransactionClient): Promise<void> {
    await this.db(tx).generation_tasks.create({
      data: {
        id: input.id,
        kind: input.kind,
        userId: input.userId,
        model: input.model,
        modelConfigId: input.modelConfigId ?? null,
        provider: input.provider ?? null,
        protocolKey: input.protocolKey ?? null,
        prompt: input.prompt ?? null,
        promptLength: input.promptLength,
        paramsSnapshot: input.paramsSnapshot,
        materialCount: input.materialCount ?? 0,
        holdId: input.holdId ?? null,
        videoGenerationId: input.videoGenerationId ?? null,
        // 毫秒精度：直接传 Date，不做任何取整。
        submittedAt: input.submittedAt ?? new Date(),
      },
    });
  }

  async markQueued(
    id: string,
    providerTaskId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const { count } = await this.db(tx).generation_tasks.updateMany({
      where: { id, status: { in: CLAIMABLE_FROM } },
      data: { status: GenerationTaskStatus.QUEUED, providerTaskId, queuedAt: new Date() },
    });
    if (count === 0) {
      // 两种可能且无法从 count 本身区分：id 已经是终态（合理跳过，并发下常见）；
      // 或 id 根本不存在（很可能是上游 bug）。这里不做额外查询判断，只把 id/
      // providerTaskId 打出来，交给排查者结合上下文判断。
      this.logger.warn(
        `markQueued: no row updated (already terminal or id not found) id=${id} providerTaskId=${providerTaskId}`,
      );
    }
  }

  /**
   * CAS 抢占终态。返回 true 表示本次抢到，调用方应继续写业务表；
   * 返回 false 表示已被并发的另一路径写成终态，调用方**必须整体放弃**（不写任何表）。
   */
  async claimTerminal(
    id: string,
    next: TerminalUpdate,
    tx: Prisma.TransactionClient,
  ): Promise<boolean> {
    const finishedAt = new Date();
    const { count } = await tx.generation_tasks.updateMany({
      where: { id, status: { in: CLAIMABLE_FROM } },
      data: {
        status: next.status,
        errorStage: next.errorStage ?? null,
        errorClass: next.errorClass ?? null,
        errorCode: next.errorCode ?? null,
        errorMessage: next.errorMessage ?? null,
        upstreamStatus: next.upstreamStatus ?? null,
        upstreamBody: next.upstreamBody ?? null,
        upstreamRequestId: next.upstreamRequestId ?? null,
        upstreamDiagnostics: next.upstreamDiagnostics ?? Prisma.JsonNull,
        imageGenerationId: next.imageGenerationId ?? null,
        durationMs: next.durationMs ?? null,
        finishedAt,
      },
    });
    return count === 1;
  }

  /**
   * 计费记录独立于主失败：`recordBilling` 不参与主事务。本方法会如实抛出
   * （行不存在时 Prisma 抛 `P2025`）——「失败只 log 不抛」是调用方
   * `GenerationTaskRecorder` 的职责，它会把这个调用包在 try/catch 里只打日志不抛，
   * 这里保持薄、不吞异常是有意为之。
   */
  async recordBilling(
    id: string,
    status: GenerationBillingStatus,
    error?: string,
  ): Promise<void> {
    await this.prisma.generation_tasks.update({
      where: { id },
      data: { billingStatus: status, billingError: error ?? null },
    });
  }

  /**
   * 迟到回调只记录，不改 status —— 终态不可变。本方法会如实抛出
   * （行不存在时 Prisma 抛 `P2025`）——同 `recordBilling`，异常保护由调用方
   * `GenerationTaskRecorder` 负责（只 log 不抛），这里不做 try/catch。
   */
  async recordLateCallback(id: string, outcome: string): Promise<void> {
    await this.prisma.generation_tasks.update({
      where: { id },
      data: { lateCallbackAt: new Date(), lateOutcome: outcome },
    });
  }
}
