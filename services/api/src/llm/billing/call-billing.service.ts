import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PointsService } from '../../points/points.service';
import type { EstimateCostInput } from '../../points/points.service';
import type { Prisma } from '../../prisma/generated';

export class InsufficientPointsError extends BadRequestException {
  constructor(required: number, available: number) {
    super(`积分余额不足：需要 ${required}，当前 ${available}`);
  }
}

export interface CallBillingEstimateMeta {
  taskType?: string;
  modelProvider?: string;
  modelName?: string;
  modelTier?: string;
  inputTokens?: number;
  outputTokens?: number;
  contextTokens?: number;
  toolCalls?: number;
}

@Injectable()
export class CallBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pointsService: PointsService,
  ) {}

  async hold(
    userId: string,
    points: number,
    meta: {
      runId?: string;
      runStepId?: string;
      modelConfigId?: string;
      modelName?: string;
      pricing?: CallBillingEstimateMeta;
      remark?: string;
      requirePricing?: boolean;
    },
  ): Promise<{ holdId: string; balance: number }> {
    const estimate = await this.estimateCallCost(
      meta.requirePricing ? undefined : points,
      meta.pricing,
    );
    const taskType = estimate?.taskType ?? meta.pricing?.taskType ?? 'agent_call';
    const amount = estimate?.estimatedCost ?? points;

    try {
      const { hold, balance } = await this.pointsService.createHold(userId, {
        taskType,
        taskId: meta.runStepId ?? meta.runId,
        amount,
        pricingSnapshot: this.toJson(estimate?.pricingSnapshot ?? {
          kind: taskType,
          modelConfigId: meta.modelConfigId,
          modelName: meta.modelName,
          estimatedPoints: amount,
        }),
        refundPolicySnapshot: estimate?.refundPolicy
          ? this.toJson(estimate.refundPolicy)
          : undefined,
        remark: meta.remark ?? `AI 对话（${meta.modelName ?? 'AI 模型'}）`,
      });
      return { holdId: hold.id, balance };
    } catch (err) {
      if (err instanceof BadRequestException) {
        const current = await this.prisma.user_points.findUnique({ where: { userId } });
        throw new InsufficientPointsError(amount, current?.balance ?? 0);
      }
      throw err;
    }
  }

  async confirm(holdId: string, actual?: CallBillingEstimateMeta): Promise<void> {
    const hold = await this.prisma.point_holds.findUnique({ where: { id: holdId } });
    const frozenAmount = hold?.estimatedAmount;
    const estimate = actual
      ? await this.estimateCallCost(undefined, actual, { suppressErrors: frozenAmount !== undefined })
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
    const records = await this.prisma.points_records.findMany({
      where: { sourceId: runId, status: 'PENDING', source: 'AGENT_CALL' },
    });

    if (records.length === 0) return;

    const holdIds = [...new Set(records.map((r) => r.holdId).filter(Boolean))] as string[];
    for (const holdId of holdIds) {
      await this.refund(holdId);
    }
  }

  private async estimateCallCost(
    fallbackPoints: number | undefined,
    pricing?: CallBillingEstimateMeta,
    opts?: { suppressErrors?: boolean },
  ) {
    if (!pricing?.taskType) return null;
    const input: EstimateCostInput = {
      taskType: pricing.taskType,
      modelProvider: pricing.modelProvider,
      modelName: pricing.modelName,
      modelTier: pricing.modelTier,
      inputTokens: pricing.inputTokens,
      outputTokens: pricing.outputTokens,
      contextTokens: pricing.contextTokens,
      toolCalls: pricing.toolCalls,
    };
    try {
      return await this.pointsService.estimateCost(input);
    } catch (err) {
      if (fallbackPoints !== undefined || opts?.suppressErrors) return null;
      throw err;
    }
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }
}
