import { BadRequestException } from '@nestjs/common';
import type {
  ResolvedImageRequest,
  SourceImageRef,
} from './image-generation-call-params';

/**
 * FIX-18: prompt 优化的输入 token 绝对上限，防止提交超大上下文消耗上游 token（DoS/超额成本）。
 */
export const PROMPT_OPTIMIZE_MAX_INPUT_TOKENS = 32_000;

export function assertPromptOptimizeInputWithinLimit(inputTokens: number): void {
  if (inputTokens > PROMPT_OPTIMIZE_MAX_INPUT_TOKENS) {
    throw new BadRequestException(
      `Prompt 优化输入过长（约 ${inputTokens} tokens），上限 ${PROMPT_OPTIMIZE_MAX_INPUT_TOKENS}`,
    );
  }
}
import {
  formatBillingModel,
  normalizeImageQuality,
  toImageFlowJsonValue,
  type ImageFlowModelConfigLike,
} from './image-generation-flow.core';

export const IMAGE_GENERATION_TASK_TYPE = 'image_generation';

export function resolveImagePricingTaskType(_request: ResolvedImageRequest): string {
  return IMAGE_GENERATION_TASK_TYPE;
}

export function buildPromptOptimizeEstimateInput(
  taskType: string,
  config: ImageFlowModelConfigLike,
  tokens: { inputTokens: number; outputTokens: number },
  membershipLevel?: number,
) {
  return {
    taskType,
    modelConfigId: config.id,
    params: {},
    usage: { inputTokens: tokens.inputTokens, outputTokens: tokens.outputTokens },
    ...(membershipLevel !== undefined ? { membershipLevel } : {}),
  };
}

export function buildPromptOptimizeHoldMetadata(input: {
  mode: 'generate' | 'edit';
  prompt: string;
  sourceImages?: SourceImageRef[];
  referenceImages?: SourceImageRef[];
  config: ImageFlowModelConfigLike;
  tokens: { inputTokens: number; outputTokens: number };
}) {
  return {
    mode: input.mode,
    promptLength: input.prompt.length,
    modelConfigId: input.config.id,
    modelName: input.config.model,
    inputTokens: input.tokens.inputTokens,
    estimatedOutputTokens: input.tokens.outputTokens,
    referenceImages:
      (input.sourceImages?.length ?? 0) +
      (input.referenceImages?.length ?? 0),
  };
}

export function buildPromptOptimizeHoldRemark(
  provider: string | null | undefined,
  model: string,
): string {
  return `图片工作台 Prompt AI 优化 · ${formatBillingModel(provider, model)}`;
}

export function buildPromptOptimizeHoldCreateInput(input: {
  taskType: string;
  taskId: string;
  estimate: {
    estimatedCost: number;
    pricingSnapshot?: unknown;
  };
  mode: 'generate' | 'edit';
  prompt: string;
  sourceImages?: SourceImageRef[];
  referenceImages?: SourceImageRef[];
  config: ImageFlowModelConfigLike;
  tokens: { inputTokens: number; outputTokens: number };
}) {
  return {
    taskType: input.taskType,
    taskId: input.taskId,
    amount: input.estimate.estimatedCost,
    pricingSnapshot: toImageFlowJsonValue(input.estimate.pricingSnapshot),
    metadata: toImageFlowJsonValue(
      buildPromptOptimizeHoldMetadata({
        mode: input.mode,
        prompt: input.prompt,
        sourceImages: input.sourceImages,
        referenceImages: input.referenceImages,
        config: input.config,
        tokens: input.tokens,
      }),
    ),
    remark: buildPromptOptimizeHoldRemark(
      input.config.provider,
      input.config.model,
    ),
  };
}

/**
 * 计价入参。
 *
 * **不再手写 resolution** —— 它由 estimator 的 `deriveParams` 从 size 派生
 * （spec §6.2/§6.3）。在这里再算一遍就是两处实现、两套口径，迟早分裂。
 *
 * **不含张数**：pricingSchema 只描述「一张」的参数与价格，多图的「单张价 × 张数」
 * 由 image-generation-flow.service 在 createHold 时算（见该处注释）。
 *
 * 这里只做两件事：把用户参数原样交出去（脏键由 estimator 的白名单投影剔除），
 * 外加注入一个用户不可自报的计价参数 —— referenceImages（按真实上传张数收费）。
 *
 * `quality` 是例外：先过 `normalizeImageQuality`（小写 + trim）再交出去。客户端
 * 发 `'HIGH'` / `' high '` 这种非规范大小写，如果原样透传，会在 ajv 的 `enum`
 * 上 400（本轮 review 发现的回归——之前这里确实调用过 normalizeImageQuality，
 * 重构时被漏掉了）。这不是新增容错，是把第 1 期就有的容错行为找回来。
 */
export function buildImageGenerationEstimateInput(
  request: ResolvedImageRequest,
  membershipLevel?: number,
) {
  const referenceImages =
    (request.sourceImages?.length ?? 0) + (request.referenceImages?.length ?? 0);
  const settings = request.settings ?? {};
  const normalizedQuality = normalizeImageQuality(settings.quality);
  return {
    taskType: resolveImagePricingTaskType(request),
    modelConfigId: request.modelConfig.id,
    params: {
      ...settings,
      // 只有 caller 实际发了 quality、且能归一出非空值时才覆盖；不发 quality
      // 的调用（canvas 无质量选择器）保持原样交给 applyParamDefaults 去填。
      ...(normalizedQuality !== undefined ? { quality: normalizedQuality } : {}),
      referenceImages,
    } as Record<string, unknown>,
    ...(membershipLevel !== undefined ? { membershipLevel } : {}),
  };
}

export function buildImageGenerationHoldMetadata(
  input: {
    templateId: string;
    modelConfigId: string;
    conversationId?: string;
  },
  request: ResolvedImageRequest,
) {
  return {
    templateId: input.templateId,
    modelConfigId: input.modelConfigId,
    conversationId: input.conversationId ?? null,
    mode: request.mode,
    prompt: request.prompt,
  };
}

export function buildImageGenerationHoldRemark(taskType: string): string {
  return taskType === IMAGE_GENERATION_TASK_TYPE
    ? 'image-generation'
    : `image-generation:${taskType}`;
}

export function buildImageGenerationHoldCreateInput(input: {
  taskId: string;
  estimate: {
    taskType: string;
    estimatedCost: number;
    pricingSnapshot?: unknown;
  };
  /**
   * 请求生成张数。计价 schema 只算单张（张数已从 pricingSchema 移除，由业务逻辑吃掉），
   * 所以冻结额 = 单张价 × 张数，才能覆盖多图；结算时按实际产图数扣、退回未用部分。
   * pricingSnapshot 保持单张不变（结算 quoteHoldFromSnapshot 返回单张价，再 × 实际张数）。
   */
  count: number;
  requestInput: {
    templateId: string;
    modelConfigId: string;
    conversationId?: string;
  };
  request: ResolvedImageRequest;
  /** 会员等级的图片并发上限，交给 createHold 在事务内原子校验。 */
  concurrencyLimit?: number;
}) {
  return {
    taskType: input.estimate.taskType,
    taskId: input.taskId,
    amount: input.estimate.estimatedCost * Math.max(1, input.count),
    pricingSnapshot: toImageFlowJsonValue(input.estimate.pricingSnapshot),
    metadata: toImageFlowJsonValue(
      buildImageGenerationHoldMetadata(input.requestInput, input.request),
    ),
    remark: buildImageGenerationHoldRemark(input.estimate.taskType),
    concurrencyLimit: input.concurrencyLimit,
  };
}
