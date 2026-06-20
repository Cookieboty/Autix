import { VideoClipStatus, VideoGenStatus, type Prisma } from '../../platform/prisma/generated';
import type {
  SeedanceContentItem,
  SeedanceTaskRequest,
} from './seedance-api.service';
import {
  getSeedanceDuration,
  getSeedanceErrorMessage,
  getSeedanceLastFrameUrl,
  getSeedanceStatus,
  getSeedanceVideoUrl,
  type SeedanceTaskPayload,
} from './seedance-task-payload';

export interface VideoGenerationClipParams {
  model?: string;
  resolution?: string;
  ratio?: string;
  duration?: number;
  seed?: number;
  generateAudio?: boolean;
  generate_audio?: boolean;
  watermark?: boolean;
  modelConfigId?: string;
  generationMode?: string;
  storyboardPrompt?: string;
}

export type NormalizedVideoResolution = '480p' | '720p' | '1080p';

export interface VideoGenerationRequestLimits {
  resolution: NormalizedVideoResolution;
  durationSeconds: number;
}

export interface SeedanceContentSummary {
  referenceImages: number;
  hasVideoInput: boolean;
  hasAudioInput: boolean;
}

export interface SeedanceCostEstimateInput {
  taskType: string;
  modelName: string;
  resolution: NormalizedVideoResolution;
  seconds: number;
  referenceImages: number;
  hasVideoInput: boolean;
  hasAudioInput: boolean;
}

export interface SeedanceTaskRequestOptions {
  model: string;
  content: SeedanceContentItem[];
  callbackUrl?: string;
  returnLastFrame: boolean;
  generateAudio?: boolean;
  resolution?: string;
  ratio?: string;
  duration?: number;
  seed?: number;
  watermark?: boolean;
}

export interface VideoHoldInput {
  taskType: string;
  taskId: string;
  amount: number;
  pricingSnapshot: Prisma.InputJsonValue;
  refundPolicySnapshot: Prisma.InputJsonValue;
  metadata: Prisma.InputJsonValue;
  remark: string;
}

export type NormalizedSeedanceTaskOutcome =
  | { kind: 'missing_status' }
  | {
      kind: 'succeeded';
      externalStatus: string;
      sourceUrl: string | undefined;
      lastFrameUrl: string | null;
      durationSec: number | null;
    }
  | {
      kind: 'failed';
      externalStatus: string;
      generationStatus: VideoGenStatus;
      error: string;
      refundReason: string;
    }
  | { kind: 'active'; externalStatus: string };

export interface GenerateAllClipCandidate {
  id: string;
  chainFromPrev: boolean;
  status: VideoClipStatus;
}

export interface GenerateAllClipResult {
  generationId: unknown;
  taskId: string;
  clipId: string;
}

export interface PresentedGenerateAllClipResult {
  generationId: string;
  taskId: string;
  clipId: string;
}

export function resolveClipPrompt(
  prompt: string | null,
  params: Pick<VideoGenerationClipParams, 'generationMode' | 'storyboardPrompt'>,
): string {
  const clipPrompt = prompt?.trim() ?? '';
  const storyboardPrompt =
    params.generationMode === 'storyboard' && typeof params.storyboardPrompt === 'string'
      ? params.storyboardPrompt.trim()
      : '';

  return [
    storyboardPrompt ? `整片提示词：${storyboardPrompt}` : '',
    clipPrompt ? `当前分镜提示词：${clipPrompt}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function normalizeVideoResolution(
  value: string | undefined,
): NormalizedVideoResolution {
  const resolution = String(value ?? '720p').toLowerCase();
  if (resolution.includes('1080')) return '1080p';
  if (resolution.includes('480')) return '480p';
  return '720p';
}

export function normalizeVideoDuration(value: number | undefined): number {
  const duration = Number(value ?? 5);
  if (!Number.isFinite(duration) || duration <= 0) return 5;
  return Math.ceil(duration);
}

export function resolveVideoGenerateAudio(
  params: Pick<VideoGenerationClipParams, 'generateAudio' | 'generate_audio'>,
): boolean | undefined {
  return params.generateAudio ?? params.generate_audio;
}

export function resolveVideoGenerationRequestLimits(
  params: Pick<VideoGenerationClipParams, 'resolution' | 'duration'>,
): VideoGenerationRequestLimits {
  return {
    resolution: normalizeVideoResolution(params.resolution),
    durationSeconds: normalizeVideoDuration(params.duration),
  };
}

export function resolveSeedancePricingTaskType(
  params: Pick<VideoGenerationClipParams, 'resolution'>,
  model: string,
): string {
  const modelName = model.toLowerCase();
  const resolution = normalizeVideoResolution(params.resolution);
  if (resolution === '1080p') return 'seedance_1080p';
  if (resolution === '480p') return 'seedance_480p';
  if (modelName.includes('fast')) return 'seedance_fast_720p';
  return 'seedance_720p';
}

export function buildSeedanceTaskRequestOptions(input: {
  params: VideoGenerationClipParams;
  model: string;
  content: SeedanceContentItem[];
  callbackUrl?: string;
  returnLastFrame: boolean;
}): SeedanceTaskRequestOptions {
  return {
    model: input.params.model ?? input.model,
    content: input.content,
    callbackUrl: input.callbackUrl,
    returnLastFrame: input.returnLastFrame,
    generateAudio: resolveVideoGenerateAudio(input.params),
    resolution: input.params.resolution,
    ratio: input.params.ratio,
    duration: input.params.duration,
    seed: input.params.seed,
    watermark: input.params.watermark,
  };
}

export function summarizeSeedanceContent(
  content: SeedanceContentItem[],
): SeedanceContentSummary {
  return {
    referenceImages: content.filter((item) => item.type === 'image_url').length,
    hasVideoInput: content.some((item) => item.type === 'video_url'),
    hasAudioInput: content.some((item) => item.type === 'audio_url'),
  };
}

export function buildSeedanceCostEstimateInput(input: {
  params: Pick<VideoGenerationClipParams, 'resolution' | 'duration'>;
  model: string;
  content: SeedanceContentItem[];
}): SeedanceCostEstimateInput {
  return {
    taskType: resolveSeedancePricingTaskType(input.params, input.model),
    modelName: input.model,
    resolution: normalizeVideoResolution(input.params.resolution),
    seconds: normalizeVideoDuration(input.params.duration),
    ...summarizeSeedanceContent(input.content),
  };
}

export function toPrismaInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

export function buildVideoHoldInput(input: {
  billingTaskType: string;
  generationId: string;
  estimatedCost: number;
  pricingSnapshot: unknown;
  refundPolicy: unknown;
  projectId: string;
  clipId: string;
  modelConfigId: string;
  taskRequest: SeedanceTaskRequest;
}): VideoHoldInput {
  return {
    taskType: input.billingTaskType,
    taskId: input.generationId,
    amount: input.estimatedCost,
    pricingSnapshot: toPrismaInputJson(input.pricingSnapshot),
    refundPolicySnapshot: toPrismaInputJson(input.refundPolicy),
    metadata: toPrismaInputJson({
      projectId: input.projectId,
      clipId: input.clipId,
      modelConfigId: input.modelConfigId,
      seedanceTaskRequest: input.taskRequest,
    }),
    remark: `video-generation:${input.billingTaskType}`,
  };
}

export function normalizeSeedanceTaskOutcome(
  payload: SeedanceTaskPayload,
): NormalizedSeedanceTaskOutcome {
  const status = getSeedanceStatus(payload);
  if (!status) return { kind: 'missing_status' };

  if (status === 'succeeded') {
    return {
      kind: 'succeeded',
      externalStatus: status,
      sourceUrl: getSeedanceVideoUrl(payload),
      lastFrameUrl: getSeedanceLastFrameUrl(payload) ?? null,
      durationSec: getSeedanceDuration(payload),
    };
  }

  if (status === 'failed' || status === 'expired') {
    const error = getSeedanceErrorMessage(payload, status);
    return {
      kind: 'failed',
      externalStatus: status,
      generationStatus:
        status === 'expired' ? VideoGenStatus.expired : VideoGenStatus.failed,
      error,
      refundReason:
        status === 'expired' ? '视频生成超时' : `视频生成失败: ${error}`,
    };
  }

  return { kind: 'active', externalStatus: status };
}

export function getPendingHeadClips<T extends GenerateAllClipCandidate>(
  clips: T[],
): T[] {
  return clips.filter(
    (clip) =>
      !clip.chainFromPrev && clip.status === VideoClipStatus.pending,
  );
}

export function getFirstPendingClip<T extends Pick<GenerateAllClipCandidate, 'status'>>(
  clips: T[],
): T | undefined {
  return clips.find((clip) => clip.status === VideoClipStatus.pending);
}

export function presentGenerateAllClipResults(
  results: Array<GenerateAllClipResult | null>,
): PresentedGenerateAllClipResult[] {
  return results
    .filter((result): result is GenerateAllClipResult => result !== null)
    .map((result) => ({
      generationId: String(result.generationId),
      taskId: result.taskId,
      clipId: result.clipId,
    }));
}
