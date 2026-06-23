import type { Prisma } from '../../../platform/prisma/generated';
import type { ResolvedImageRequest } from './image-generation-call-params';

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

export function normalizeImageGenerationCount(count: number): number {
  return Math.max(1, Math.min(count, 4));
}

export function isUserOwnedImageModel(
  userId: string,
  request: Pick<ResolvedImageRequest, 'modelConfig'>,
): boolean {
  return request.modelConfig.createdBy === userId;
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
