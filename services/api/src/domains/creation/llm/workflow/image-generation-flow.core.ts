import type { Prisma } from '../../../platform/prisma/generated';

const IMAGE_DATA_URL_RE = /^data:image\/(\w+);base64,/i;

export function asImageFlowRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : undefined;
}

export function isImageDataUrl(value: string | undefined | null): value is string {
  return typeof value === 'string' && IMAGE_DATA_URL_RE.test(value);
}

export function normalizeImageQuality(value: unknown): string | undefined {
  const quality = String(value ?? '').trim().toLowerCase();
  return quality || undefined;
}

export function formatBillingModel(
  provider: string | null | undefined,
  model: string,
): string {
  return [provider, model].filter(Boolean).join('/') || model;
}

export interface ImageFlowModelConfigLike {
  id: string;
  model: string;
  provider?: string | null;
  capabilities?: string[] | null;
  createdBy?: string | null;
}

export function toImageFlowJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

/**
 * dispatch 入口的**唯一** clamp 点。上限由调用方给出
 * （`resolveImageCountCeiling(metadata)` = 模型能力 ∩ 风控硬上限）；缺省是风控硬上限，
 * 保持既有调用点行为不变。
 */
export function normalizeImageGenerationCount(count: number, ceiling = 4): number {
  return Math.max(1, Math.min(count, Math.max(1, ceiling)));
}

export function resolvePersistedGenerationId(
  generation: unknown,
  fallbackId: string,
): string {
  return typeof (generation as { id?: unknown })?.id === 'string'
    ? (generation as { id: string }).id
    : fallbackId;
}

export function getUploadFailureLogDetails(input: {
  image: unknown;
  index: number;
  reason: unknown;
}): { index: number; sizeHint: number; preview: string; reason: string } {
  const preview =
    typeof input.image === 'string' ? input.image.slice(0, 32) : '';
  const sizeHint = typeof input.image === 'string' ? input.image.length : 0;
  return {
    index: input.index,
    sizeHint,
    preview,
    reason: String(input.reason),
  };
}
