import { BadRequestException } from '@nestjs/common';
import { UpstreamParamsInvalidError } from '@autix/ai-adapters/core';
import type { ImageCallContext } from '@autix/ai-adapters/image';
import {
  coerceImageParams,
  detectImageModelKind,
  IMAGE_MODEL_CAPABILITIES,
  type ImageModelKind,
} from '@autix/domain/image';
import type { Prisma } from '../../../platform/prisma/generated';

interface SafeDefaults {
  size: string;
  quality?: string;
  count: number;
}

// Per-kind fallback used by the one-shot retry path. Each entry is guaranteed
// to be inside the corresponding capability whitelist, so the second attempt
// can never trip the same upstream 4xx for params.
export const SAFE_IMAGE_DEFAULTS_BY_KIND: Record<ImageModelKind, SafeDefaults> = {
  'gpt-image': { size: 'auto', quality: 'medium', count: 1 },
  'gemini-flash-image': { size: '1024x1024', count: 1 },
  'gemini-3-pro-image': { size: '1024x1024@1K', count: 1 },
  'gemini-3-flash-image': { size: '1024x1024@1K', count: 1 },
  compatible: { size: '1024x1024', quality: 'standard', count: 1 },
};

// Heuristic: any upstream HTTP status in [400, 500) is treated as a retryable
// "parameter" failure. Adapters use `assertResponseOk` which embeds the status
// code as ` <status>: ` inside the Error message; we match that. Typed
// `UpstreamParamsInvalidError` is handled separately by direct instanceof check.
const UPSTREAM_4XX_RE = /\s(4\d{2}):\s/;

export interface AppliedImageSettings {
  size?: string;
  quality?: string;
  count: number;
  coerced: boolean;
  notes: string[];
  kind: ImageModelKind;
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
    createdBy?: string | null;
  };
  template: Record<string, unknown>;
  variables: Record<string, string>;
  sourceImages?: SourceImageRef[];
  referenceImages?: SourceImageRef[];
  settings?: ImageGenerationSettings;
}

export interface NormalizedImageCallParams {
  kind: ImageModelKind;
  metadata?: Record<string, unknown>;
  primaryContext: ImageCallContext;
  primaryAppliedSettings: AppliedImageSettings;
  safeContext: ImageCallContext;
  safeAppliedSettings: AppliedImageSettings;
  safeDefaults: SafeDefaults;
}

export function isUpstreamImageParamsError(err: unknown): boolean {
  if (err instanceof UpstreamParamsInvalidError) return true;
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return UPSTREAM_4XX_RE.test(msg);
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
    request.modelConfig.apiKey ??
    (typeof metadata?.apiKey === 'string' ? metadata.apiKey : '');
  const baseUrl =
    request.modelConfig.baseUrl ??
    (typeof metadata?.baseUrl === 'string' ? metadata.baseUrl : '');
  return { baseUrl, apiKey };
}

export function normalizeImageCallParams(
  request: ResolvedImageRequest,
  count: number,
): NormalizedImageCallParams {
  const metadata = asImageCallMetadata(request.modelConfig.metadata);
  const { baseUrl, apiKey } = resolveImageCallCredentials(request, metadata);
  const kind = detectImageModelKind({
    provider: request.modelConfig.provider ?? undefined,
    model: request.modelConfig.model,
  });

  const coerced = coerceImageParams({
    kind,
    size: request.settings?.size,
    quality: request.settings?.quality,
    count,
    negativePrompt:
      typeof request.settings?.negativePrompt === 'string'
        ? request.settings.negativePrompt
        : undefined,
  });
  const safeDefaults = SAFE_IMAGE_DEFAULTS_BY_KIND[kind];
  const buildContext = (params: {
    size?: string;
    quality?: string;
    count: number;
  }): ImageCallContext => ({
    baseUrl,
    apiKey,
    model: request.modelConfig.model,
    prompt: request.prompt,
    count: params.count,
    size: params.size,
    quality: params.quality,
    sourceImages: request.sourceImages,
    referenceImages: request.referenceImages,
    metadata,
  });

  return {
    kind,
    metadata,
    primaryContext: buildContext({
      size: coerced.size,
      quality: coerced.quality,
      count: coerced.count,
    }),
    primaryAppliedSettings: {
      size: coerced.size,
      quality: coerced.quality,
      count: coerced.count,
      coerced: coerced.notes.length > 0,
      notes: coerced.notes,
      kind,
    },
    safeContext: buildContext({
      size: safeDefaults.size,
      quality: safeDefaults.quality,
      count: safeDefaults.count,
    }),
    safeAppliedSettings: {
      size: safeDefaults.size,
      quality: safeDefaults.quality,
      count: safeDefaults.count,
      coerced: true,
      notes: [
        ...coerced.notes,
        `upstream 4xx fallback → safe defaults for kind=${kind}`,
      ],
      kind,
    },
    safeDefaults,
  };
}

export function buildUnsupportedImageParamsException(
  request: ResolvedImageRequest,
  kind: ImageModelKind,
  firstError: unknown,
  retryError: unknown,
): BadRequestException {
  const cap = IMAGE_MODEL_CAPABILITIES[kind];
  return new BadRequestException({
    errorCode: 'ERR_IMAGE_PARAMS_NOT_SUPPORTED',
    message: `当前模型不支持所选参数，请尝试其他尺寸或质量。（${cap.displayName}）`,
    details: {
      kind,
      model: request.modelConfig.model,
      firstError: firstError instanceof Error ? firstError.message : String(firstError),
      retryError: retryError instanceof Error ? retryError.message : String(retryError),
    },
  });
}
