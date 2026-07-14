import { BadRequestException } from '@nestjs/common';
import {
  resolveImagePreset,
  type ImageArtifact,
  type ImageCallRequest,
  type ImageUpstreamError,
} from '@autix/ai-adapters/image';
import { readImageModelMetadata } from '@autix/domain/model';
import { pickWireParams, type ParamsSchema } from '@autix/domain/pricing';
import type { Prisma } from '../../../platform/prisma/generated';
import { resolveApiKey, resolveBaseUrl } from '../../model-config/model-gateway-credentials';

/**
 * 「真正发出去的值」（spec §4.4）。它不再是固定 9 字段的 settings 袋 —— key 由
 * preset 的绑定决定，由 `ImageCallResult.applied.params` 回填。此前这里记的是
 * 「我们打算发的值」，与实际请求体可能不一致（DB 记录的参数 ≠ 实际发出的参数）。
 */
export interface AppliedImageSettings {
  count: number;
  coerced: boolean;
  notes: string[];
  [key: string]: unknown;
}

export interface CallImageApiResult {
  images: string[];
  appliedSettings: AppliedImageSettings;
}

export interface SourceImageRef {
  url: string;
  prompt?: string;
  generationId?: string;
  index?: number;
}

/**
 * 用户提交的参数袋。**不再是固定字段的枚举** —— 具体有哪些参数由模型的
 * paramsSchema 声明，服务端用 `pickWireParams` / `stripNonPricingParams`
 * 两个白名单投影分别筛出上游子集与计价子集。这里保留几个字段只是为了让
 * 现存调用点（entitlement 闸门读 size/quality、prompt 微调读 promptTuning）
 * 有类型可用，不代表 schema 只允许这些。
 */
export interface ImageGenerationSettings {
  size?: string;
  quality?: string;
  promptTuning?: string;
  stylePreset?: string;
  negativePrompt?: string;
  skipPromptTuning?: boolean;
  guidanceScale?: number;
  steps?: number;
  seed?: string;
  [key: string]: unknown;
}

export interface ResolvedImageRequest {
  mode: 'generate' | 'edit';
  prompt: string;
  modelConfig: {
    id: string;
    model: string;
    provider?: string | null;
    baseUrl?: string | null;
    apiKey?: string | null;
    metadata?: Prisma.JsonValue | null;
    /** 同一条 model_configs 记录里的 paramsSchema —— 投影与校验都靠它，不再另发一次查询。 */
    paramsSchema?: Prisma.JsonValue | null;
    createdBy?: string | null;
  };
  template: Record<string, unknown>;
  variables: Record<string, string>;
  sourceImages?: SourceImageRef[];
  referenceImages?: SourceImageRef[];
  settings?: ImageGenerationSettings;
}

export function asImageCallMetadata(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : undefined;
}

export function resolveImageCallCredentials(
  request: ResolvedImageRequest,
  metadata = asImageCallMetadata(request.modelConfig.metadata),
): { baseUrl: string; apiKey: string } {
  const apiKey =
    resolveApiKey({ apiKey: request.modelConfig.apiKey, metadata }) ?? '';
  const baseUrl =
    resolveBaseUrl({ baseUrl: request.modelConfig.baseUrl, metadata }) ?? '';
  return { baseUrl, apiKey };
}

/**
 * paramsSchema 是投影的白名单。它缺席时**必须拒绝**，不能当成空 schema：
 * 空 schema 会让 `pickWireParams` 丢掉每一个 wire 参数，静默按上游默认值出图
 * （用户选的尺寸/质量全部失效），而计价那边早就按用户参数收了钱。
 * 正常路径上 estimateCost 已经先于此拒绝了 paramsSchema 为 NULL 的模型。
 */
export function narrowImageParamsSchema(
  value: Prisma.JsonValue | null | undefined,
  modelConfigId: string,
): ParamsSchema {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException(`模型未配置参数规则(paramsSchema): ${modelConfigId}`);
  }
  return value as unknown as ParamsSchema;
}

/**
 * 不再嗅探 kind、不再猜协议：`metadata.protocolKey` 显式声明，preset 决定一切
 * （spec §5）。未注册的 protocolKey 直接抛 —— 没有静默 fallback adapter。
 *
 * count 的上限在 dispatch 入口一次性 clamp（`resolveImageCountCeiling` + risk 硬上限），
 * 这里不再各自 clamp。
 */
export function buildImageCallRequest(
  request: ResolvedImageRequest,
  count: number,
  paramsSchema: ParamsSchema,
): ImageCallRequest {
  const { apiKey, baseUrl } = resolveImageCallCredentials(request);
  const metadata = readImageModelMetadata(request.modelConfig.metadata);
  const preset = resolveImagePreset(metadata.protocolKey);

  return {
    preset,
    operation: request.mode === 'edit' ? 'edit' : 'generate',
    baseUrl,
    apiKey,
    model: request.modelConfig.model,
    prompt: request.prompt,
    count,
    params: pickWireParams(paramsSchema, request.settings ?? {}),
    sourceImages: request.sourceImages,
    referenceImages: request.referenceImages,
  };
}

/**
 * `ai-adapters` 是纯协议层（spec §8）：artifact → data-uri / url 的转换留在 api-service。
 */
export function toImageUrlOrDataUri(artifact: ImageArtifact): string {
  return artifact.source.type === 'base64'
    ? `data:${artifact.source.mimeType};base64,${artifact.source.data}`
    : artifact.source.url;
}

/**
 * `ERR_IMAGE_PARAMS_NOT_SUPPORTED` 是前端契约的一部分（spec §7.3），保留。
 *
 * 变的是触发条件：从「正则匹配到 4xx，重试一次 safe defaults，再失败才抛」变成
 * 「preset 的 errorMapping 把这次失败分类成 `params` → 直接抛」。4xx → safe-defaults
 * 重试整条删除：它的 safe defaults 仍是同一个 `1024x1024@1K`，从未修好过任何东西，
 * 只是把上游多打了一次；preset 的 stripTierSuffix 从根上消除了那个失败模式。
 */
export function buildUnsupportedImageParamsException(
  request: ResolvedImageRequest,
  error: ImageUpstreamError,
): BadRequestException {
  const metadata = readImageModelMetadata(request.modelConfig.metadata);
  return new BadRequestException({
    errorCode: 'ERR_IMAGE_PARAMS_NOT_SUPPORTED',
    message: `当前模型不支持所选参数，请尝试其他尺寸或质量。（${request.modelConfig.model}）`,
    details: {
      model: request.modelConfig.model,
      protocolKey: metadata.protocolKey,
      httpStatus: error.httpStatus,
      upstreamError: error.message,
    },
  });
}
