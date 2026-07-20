import { Injectable } from '@nestjs/common';
import {
  GenerationBillingStatus,
  GenerationTaskStatus,
  type GenerationErrorStage,
  type GenerationKind,
  type Prisma,
} from '../prisma/generated';
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
  imageGenerationId?: string;
  durationMs?: number;
}

@Injectable()
export class GenerationTaskRepository {
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
    await this.db(tx).generation_tasks.updateMany({
      where: { id, status: { in: CLAIMABLE_FROM } },
      data: { status: GenerationTaskStatus.QUEUED, providerTaskId, queuedAt: new Date() },
    });
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
        imageGenerationId: next.imageGenerationId ?? null,
        durationMs: next.durationMs ?? null,
        finishedAt,
      },
    });
    return count === 1;
  }

  /** 计费记录独立于主失败：`recordBilling` 不参与主事务，失败只 log 不抛。 */
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

  /** 迟到回调只记录，不改 status —— 终态不可变。 */
  async recordLateCallback(id: string, outcome: string): Promise<void> {
    await this.prisma.generation_tasks.update({
      where: { id },
      data: { lateCallbackAt: new Date(), lateOutcome: outcome },
    });
  }
}
