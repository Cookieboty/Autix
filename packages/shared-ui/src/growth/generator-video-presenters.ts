import {
  normalizeVideoResolutionForModel,
  resolveVideoModelCapability,
  type VideoModelCapability,
} from '@autix/domain/video';
import type { TaskEstimateInput, ModelConfigItem } from '@autix/shared-store';

export function resolveVideoCapabilityFromModelParam(
  model?: string | null,
): VideoModelCapability {
  // 无模型（DB 未配置）→ resolveVideoModelCapability 归到 'compatible' 通用能力，
  // 不做任何硬编码兜底。
  return resolveVideoModelCapability({ model: model || undefined });
}

export function resolveVideoCapabilityFromModelConfig(
  modelConfig?: ModelConfigItem | null,
  fallbackModel?: string | null,
): VideoModelCapability {
  return resolveVideoModelCapability(
    modelConfig ?? { model: fallbackModel || undefined },
  );
}

function normalizeModelHint(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function modelHintTokens(value: string | null | undefined) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => normalizeModelHint(token))
    .filter(Boolean);
}

function modelHintMatches(candidate: string | null | undefined, hint: string | null | undefined) {
  const normalizedCandidate = normalizeModelHint(candidate);
  const normalizedHint = normalizeModelHint(hint);
  if (!normalizedCandidate || !normalizedHint) return false;
  if (normalizedCandidate.includes(normalizedHint)) return true;
  const tokens = modelHintTokens(hint);
  return tokens.length > 1 && tokens.every((token) => normalizedCandidate.includes(token));
}

export function findVideoModelByHint(
  models: ModelConfigItem[],
  hint: string | null | undefined,
) {
  const normalizedHint = normalizeModelHint(hint);
  if (!normalizedHint) return null;
  return models.find((model) =>
    [
      model.id,
      model.name,
      model.model,
      `${model.provider ?? ''} ${model.model ?? ''}`,
    ].some((candidate) => modelHintMatches(candidate, hint)),
  ) ?? null;
}

export function buildPublicVideoEstimateInput({
  model,
  modelConfig,
  duration,
  resolution,
  generateAudio,
  referenceImages = 0,
}: {
  model?: string | null;
  modelConfig?: ModelConfigItem | null;
  duration: number;
  resolution: string;
  generateAudio: boolean;
  referenceImages?: number;
}): TaskEstimateInput {
  return {
    taskType: 'video_generation',
    modelConfigId: modelConfig?.id,
    params: {
      resolution: normalizeVideoResolutionForModel(
        resolution,
        modelConfig ?? { model: model || undefined },
      ),
      seconds: Math.max(1, Math.ceil(Number(duration) || 1)),
      referenceImages: Math.max(0, Math.floor(Number(referenceImages) || 0)),
      hasVideoInput: false,
      hasAudioInput: generateAudio,
    },
  };
}

function positiveInteger(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : null;
}

export function getVideoReferenceUploadLimit(modelConfig?: ModelConfigItem | null) {
  const metadata = modelConfig?.metadata as Record<string, unknown> | undefined;
  if (!metadata) return 12;
  for (const key of [
    'maxReferenceImages',
    'videoMaxReferenceImages',
    'referenceImageLimit',
    'maxInputImages',
    'imageInputLimit',
  ] as const) {
    const limit = positiveInteger(metadata[key]);
    if (limit != null) return limit;
  }
  return 12;
}
