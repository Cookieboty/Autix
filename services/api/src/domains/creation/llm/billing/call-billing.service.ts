import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PointsService } from '../../../billing/points/points.service';
import { MembershipService } from '../../../billing/membership/membership.service';
import type { TaskEstimateInput, TaskEstimateResult } from '../../../billing/points/points.service';
import { PointsSource, type Prisma } from '../../../platform/prisma/generated';
import { LlmRepository } from '../llm.repository';

export class InsufficientPointsError extends BadRequestException {
  constructor(required: number, available: number) {
    super(`积分余额不足：需要 ${required}，当前 ${available}`);
  }
}

export interface CallBillingEstimateMeta {
  taskType: string;
  modelConfigId?: string;
  /**
   * @deprecated The new pricing engine matches on `taskType` + `modelConfigId`
   * (task_model_bindings), not on provider/model-name string sniffing. These two
   * fields are no longer read for pricing — they are kept only so the one
   * out-of-scope caller of this service that still sets them (artifact.service.ts,
   * owned by a different task) keeps typechecking without being touched here.
   */
  modelProvider?: string;
  /** @deprecated See modelProvider above. */
  modelName?: string;
  inputTokens?: number;
  outputTokens?: number;
  contextTokens?: number;
  toolCalls?: number;
  mcpCalls?: number;
  skillCalls?: number;
  membershipLevel?: number;
}

@Injectable()
export class CallBillingService {
  private readonly logger = new Logger(CallBillingService.name);

  constructor(
    private readonly repository: LlmRepository,
    private readonly pointsService: PointsService,
    private readonly membershipService: MembershipService,
  ) {}

  async hold(
    userId: string,
    _points: number,
    meta: {
      runId?: string;
      runStepId?: string;
      modelConfigId?: string;
      modelName?: string;
      pricing?: CallBillingEstimateMeta;
      remark?: string;
      /**
       * @deprecated There is no longer a "skip pricing, charge points directly"
       * path to opt into — every hold is always priced through the pricing
       * engine. Kept only for type back-compat with the one out-of-scope caller
       * that still sets it (artifact.service.ts).
       */
      requirePricing?: boolean;
    },
  ): Promise<{ holdId: string; balance: number }> {
    if (!meta.pricing?.taskType) {
      throw new BadRequestException('缺少计费所需的 taskType');
    }

    const estimate = await this.estimateCallCost(meta.pricing, { userId });
    if (!estimate) {
      // Unreachable in practice: estimateCallCost only ever returns null when the
      // caller opts into `suppressErrors`, which hold() never does — it either
      // resolves a real estimate or throws. This guard exists so TypeScript
      // narrows `estimate` below without a cast, not because this branch fires.
      throw new BadRequestException('缺少计费所需的 taskType');
    }

    const taskType = estimate.taskType;
    const amount = estimate.estimatedCost;

    try {
      const { hold, balance } = await this.pointsService.createHold(userId, {
        taskType,
        taskId: meta.runStepId ?? meta.runId,
        source: PointsSource.AGENT_CALL,
        amount,
        pricingSnapshot: this.toJson(estimate.pricingSnapshot),
        remark: meta.remark ?? `AI 对话（${meta.modelName ?? 'AI 模型'}）`,
      });
      return { holdId: hold.id, balance };
    } catch (err) {
      if (err instanceof BadRequestException) {
        const current = await this.repository.findUserPoints(userId);
        throw new InsufficientPointsError(amount, current?.balance ?? 0);
      }
      throw err;
    }
  }

  async confirm(holdId: string, actual?: CallBillingEstimateMeta): Promise<void> {
    // 结算按 hold 冻结的 pricingSnapshot 重新求值，只把真实 token 用量作为 usage 传入——
    // 绝不在结算时重读实时计价配置(estimateCost)。任务执行期间管理员改 schema/倍率/折扣
    // 都不应改变本次账单(spec: 冻结快照结算)。token 是 usage-source，不在快照 params 里，
    // 不会与冻结参数撞名。quoteHoldFromSnapshot 内部已封顶到冻结额并在超出时告警。
    if (!actual) {
      await this.pointsService.confirmHold(holdId);
      return;
    }
    // 传入完整真实用量的全部维度——admin 可基于任意维度配置 fixedCostSchema，只传
    // input/outputTokens 会在配置了 context/tool/mcp/skill 计费时静默少扣。
    const usage: Record<string, unknown> = {};
    for (const dim of [
      'inputTokens',
      'outputTokens',
      'contextTokens',
      'toolCalls',
      'mcpCalls',
      'skillCalls',
    ] as const) {
      const value = actual[dim];
      if (typeof value === 'number') usage[dim] = value;
    }
    // 快照缺失/损坏时 quoteHoldFromSnapshot 会抛错——让它硬失败向上传播，绝不 catch-all
    // 后按全额冻结确认。catch-all 会把损坏快照/DB 错误/编程错误统统静默转成全额扣费
    // (真实用量远低于预估时会多扣)，与 parsePricingSnapshot「损坏快照必须硬失败」相冲突。
    // 结算失败让 hold 保持 PENDING，交由孤儿 hold 回收 / 人工介入，而不是悄悄全额扣。
    const actualAmount = await this.pointsService.quoteHoldFromSnapshot(holdId, usage);
    await this.pointsService.confirmHold(holdId, actualAmount);
  }

  async refund(holdId: string): Promise<void> {
    await this.pointsService.refundHold(holdId, 'agent call failed');
  }

  async refundAllPending(runId: string): Promise<void> {
    const records = await this.repository.findPendingAgentCallPointRecords(runId);

    if (records.length === 0) return;

    const holdIds = [...new Set(records.map((r) => r.holdId).filter(Boolean))] as string[];
    for (const holdId of holdIds) {
      await this.refund(holdId);
    }
  }

  /**
   * Bridges `CallBillingEstimateMeta` (this file's caller-facing shape) into
   * `TaskEstimateInput` (the new pricing engine's shape: taskType +
   * modelConfigId? + params + usage) and calls `PointsService.estimateCost`.
   *
   * There is no fallback formula here. Two callers use this:
   * - `hold()`, which never sets `suppressErrors` — a thrown error always
   *   propagates out of `hold()` as a 400, never gets replaced by a
   *   caller-supplied point amount (that `pointCostWeight * basePerCall` path is
   *   deleted, not relocated).
   * - `confirm()`, which sets `suppressErrors` only when there is already a
   *   frozen `estimatedAmount` on the hold. In that narrow case, being unable to
   *   re-price at settlement time means falling back to the amount the user was
   *   already quoted and already held against — not a new, different, invented
   *   number. That is a distinct, pre-existing behaviour from the disease this
   *   task removes, and it is preserved here.
   */
  private async estimateCallCost(
    pricing: CallBillingEstimateMeta,
    opts: { userId?: string; suppressErrors?: boolean } = {},
  ): Promise<TaskEstimateResult | null> {
    const membershipLevel = pricing.membershipLevel ?? (
      opts.userId
        ? await this.membershipService.resolveActiveMembershipLevel(opts.userId)
        : undefined
    );
    const input: TaskEstimateInput = {
      taskType: pricing.taskType,
      modelConfigId: pricing.modelConfigId,
      params: {},
      usage: this.toUsage(pricing),
      membershipLevel,
    };
    try {
      return await this.pointsService.estimateCost(input);
    } catch (err) {
      // --- Task 10 (deployment-safety step) ---
      // In a real rollout this log ships as its own release, ahead of Task 11's
      // deletion below, so operations can see how often pricing misconfiguration
      // actually fires in production before the path that used to mask it is
      // removed. Here both land in one commit, but they stay two distinct,
      // separately-commented steps.
      this.logger.error(
        `pricing estimate failed: taskType=${pricing.taskType} ` +
        `modelConfigId=${pricing.modelConfigId ?? '-'} ` +
        `reason=${err instanceof Error ? err.message : String(err)}`,
      );
      // --- Task 11 (fallback deletion) ---
      // No `?? points`, no substituted pointCostWeight-derived amount. The only
      // caller allowed to swallow this is confirm() honouring an
      // already-frozen hold amount (see the doc comment above); every other
      // caller — in particular hold() — always re-throws.
      if (opts.suppressErrors) return null;
      throw err;
    }
  }

  private toUsage(pricing: CallBillingEstimateMeta): Record<string, unknown> {
    const usage: Record<string, unknown> = {};
    if (pricing.inputTokens !== undefined) usage.inputTokens = pricing.inputTokens;
    if (pricing.outputTokens !== undefined) usage.outputTokens = pricing.outputTokens;
    if (pricing.contextTokens !== undefined) usage.contextTokens = pricing.contextTokens;
    if (pricing.toolCalls !== undefined) usage.toolCalls = pricing.toolCalls;
    if (pricing.mcpCalls !== undefined) usage.mcpCalls = pricing.mcpCalls;
    if (pricing.skillCalls !== undefined) usage.skillCalls = pricing.skillCalls;
    return usage;
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }
}
