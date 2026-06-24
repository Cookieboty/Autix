import type {
  ResolvedImageRequest,
  SourceImageRef,
} from './image-generation-call-params';
import { resolveImagePricingResolution } from '@autix/domain/image';
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
    modelProvider: config.provider ?? undefined,
    modelName: config.model,
    inputTokens: tokens.inputTokens,
    outputTokens: tokens.outputTokens,
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
    refundPolicy?: unknown;
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
    refundPolicySnapshot: input.estimate.refundPolicy
      ? toImageFlowJsonValue(input.estimate.refundPolicy)
      : undefined,
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

export function buildPromptOptimizeActualEstimateInput(input: {
  taskType: string;
  config: ImageFlowModelConfigLike;
  hold: { inputTokens: number };
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    contextTokens?: number;
  };
  fallbackOutputTokens: number;
  membershipLevel?: number;
}) {
  return {
    taskType: input.taskType,
    modelProvider: input.config.provider ?? undefined,
    modelName: input.config.model,
    inputTokens: input.usage.inputTokens ?? input.hold.inputTokens,
    outputTokens: input.usage.outputTokens ?? input.fallbackOutputTokens,
    contextTokens: input.usage.contextTokens,
    ...(input.membershipLevel !== undefined ? { membershipLevel: input.membershipLevel } : {}),
  };
}

export function resolvePromptOptimizeConfirmAmount(input: {
  actualEstimatedCost: number;
  heldEstimatedCost: number;
}): number {
  return Math.min(input.actualEstimatedCost, input.heldEstimatedCost);
}

export function buildImageGenerationEstimateInput(
  request: ResolvedImageRequest,
  quantity: number,
  membershipLevel?: number,
) {
  const pricingResolution = resolveImagePricingResolution(request.settings?.size);
  return {
    taskType: IMAGE_GENERATION_TASK_TYPE,
    modelProvider: request.modelConfig.provider ?? undefined,
    modelName: request.modelConfig.model,
    quality: normalizeImageQuality(request.settings?.quality),
    ...(pricingResolution ? { resolution: pricingResolution } : {}),
    quantity: 1,
    referenceImages:
      (request.sourceImages?.length ?? 0) +
      (request.referenceImages?.length ?? 0),
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
    refundPolicy?: unknown;
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
    refundPolicySnapshot: toImageFlowJsonValue(input.estimate.refundPolicy),
    metadata: toImageFlowJsonValue(
      buildImageGenerationHoldMetadata(input.requestInput, input.request),
    ),
    remark: buildImageGenerationHoldRemark(input.estimate.taskType),
  };
}
