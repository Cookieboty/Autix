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
  /**
   * 仅收敛 cron 用：hold 已确认 REFUNDED 时随 CAS 一并把 billingStatus 打成 REFUNDED。
   * 未传时**不进 data**（不是 `?? null`）——succeed/fail 等既有调用方从不传这个字段，
   * 若默认置 null 会把 recordBilling 早先写入的 HELD/CONFIRMED 覆写掉。
   */
  billingStatus?: GenerationBillingStatus;
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
        // 有意不用 `?? null`：省略时字段完全不出现在 data 里，undefined 对 Prisma
        // 等同"未传"，不会覆写已有的 billingStatus（见 TerminalUpdate.billingStatus 注释）。
        ...(next.billingStatus !== undefined ? { billingStatus: next.billingStatus } : {}),
      },
    });
    return count === 1;
  }

  /**
   * 悬挂任务：PENDING 且从未拿到 providerTaskId（即 submit 从未成功过）。
   * 收敛 cron 唯一的候选来源；`take` 做防御性上限，避免单轮扫出过多行拖垮 cron。
   */
  async findDanglingPending() {
    return this.prisma.generation_tasks.findMany({
      where: { status: GenerationTaskStatus.PENDING, providerTaskId: null },
      select: { id: true, holdId: true, submittedAt: true, createdAt: true },
      take: 500,
    });
  }

  /**
   * 无外部事务时的 CAS（收敛 cron 专用）。收敛 cron 是运维路径，独立起自己的短事务，
   * 不借用调用方事务——这里没有"调用方事务"可借。
   */
  async claimTerminalStandalone(id: string, next: TerminalUpdate): Promise<boolean> {
    return this.prisma.$transaction((tx) => this.claimTerminal(id, next, tx));
  }

  /**
   * 计费记录独立于主失败：`recordBilling` 不参与主事务。本方法会如实抛出
   * （行不存在时 Prisma 抛 `P2025`）——「失败只 log 不抛」是调用方
   * `GenerationTaskRecorder` 的职责，它会把这个调用包在 try/catch 里只打日志不抛，
   * 这里保持薄、不吞异常是有意为之。
   *
   * `holdId` 可选：图片侧的 hold 在 `start()` 之后才建，`generation_tasks.holdId`
   * 在建行时永远写不进去；第一次 `recordBilling(HELD)` 正是 hold 已存在之后的
   * 第一个落点，故在此顺带回填。`undefined` 时 Prisma 视为字段未传，不会把已有值
   * 覆写成 null（视频侧 create 时就已写 holdId，后续调用不传即维持原值不变）。
   */
  async recordBilling(
    id: string,
    status: GenerationBillingStatus,
    error?: string,
    holdId?: string,
  ): Promise<void> {
    await this.prisma.generation_tasks.update({
      where: { id },
      data: { billingStatus: status, billingError: error ?? null, holdId },
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
