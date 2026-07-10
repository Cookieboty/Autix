import { BadRequestException } from '@nestjs/common';
import type {
  ResolvedImageRequest,
  SourceImageRef,
} from './image-generation-call-params';
import { resolveImagePricingResolution } from '@autix/domain/image';

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

export function buildImageGenerationEstimateInput(
  request: ResolvedImageRequest,
  quantity: number,
  membershipLevel?: number,
) {
  const pricingResolution = resolveImagePricingResolution(request.settings?.size);
  return {
    taskType: IMAGE_GENERATION_TASK_TYPE,
    modelConfigId: request.modelConfig.id,
    params: {
      quality: normalizeImageQuality(request.settings?.quality),
      ...(pricingResolution ? { resolution: pricingResolution } : {}),
      // FIX-24: 按真实数量计费（hold 用请求数量、settle 用实际产图数量），不再硬编码 1。
      quantity: Math.max(1, quantity),
      referenceImages:
        (request.sourceImages?.length ?? 0) +
        (request.referenceImages?.length ?? 0),
    },
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
  requestInput: {
    templateId: string;
    modelConfigId: string;
    conversationId?: string;
  };
  request: ResolvedImageRequest;
}) {
  return {
    taskType: input.estimate.taskType,
    taskId: input.taskId,
    amount: input.estimate.estimatedCost,
    pricingSnapshot: toImageFlowJsonValue(input.estimate.pricingSnapshot),
    metadata: toImageFlowJsonValue(
      buildImageGenerationHoldMetadata(input.requestInput, input.request),
    ),
    remark: buildImageGenerationHoldRemark(input.estimate.taskType),
  };
}
