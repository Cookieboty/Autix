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
    const hold = await this.repository.findPointHold(holdId);
    const frozenAmount = hold?.estimatedAmount;
    const estimate = actual
      ? await this.estimateCallCost(actual, {
          suppressErrors: frozenAmount !== undefined,
          userId: hold?.userId,
        })
      : null;
    const actualAmount =
      estimate?.estimatedCost !== undefined && frozenAmount !== undefined
        ? Math.min(estimate.estimatedCost, frozenAmount)
        : estimate?.estimatedCost;
    if (actualAmount === undefined) {
      await this.pointsService.confirmHold(holdId);
    } else {
      await this.pointsService.confirmHold(holdId, actualAmount);
    }
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
