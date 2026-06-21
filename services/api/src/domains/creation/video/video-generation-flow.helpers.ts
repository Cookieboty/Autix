import {
  VideoClipStatus,
  VideoGenStatus,
  VideoMaterialRole,
  VideoMaterialSourceType,
  type Prisma,
  type video_clip_generations,
  type video_clip_materials,
} from '../../platform/prisma/generated';
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

export type VideoGenerationMaterial = Pick<
  video_clip_materials,
  | 'id'
  | 'clipId'
  | 'role'
  | 'sourceType'
  | 'sourceId'
  | 'url'
  | 'name'
  | 'metadata'
  | 'createdAt'
>;

export interface ChainFirstFrameInput {
  clipId: string;
  generationId: string;
  lastFrameUrl: string;
  createdAt: Date;
}

export interface QueuedGenerationPollWindow {
  queryBefore: Date;
  expireBefore: Date;
}

export interface QueuedGenerationPollQueues<T> {
  toExpire: T[];
  toPoll: T[];
}

export interface PendingGenerationInput {
  generationId: string;
  clipId: string;
  projectId: string;
  userId: string;
  variantLabel?: string;
  model: string;
  resolvedPrompt: string;
  params: Prisma.InputJsonValue;
}

export interface CompletedGenerationInput {
  generationId: string;
  clipId: string;
  externalStatus: string;
  videoUrl: string;
  lastFrameUrl: string | null;
  durationSec: number | null;
}

export type SucceededGenerationVideoResolution =
  | { kind: 'failed'; reason: string }
  | { kind: 'ready'; videoUrl: string };

export interface FailedGenerationInput {
  generationId: string;
  clipId: string;
  status: VideoGenStatus;
  externalStatus: string;
  error: string;
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

export type SucceededSeedanceTaskOutcome = Extract<
  NormalizedSeedanceTaskOutcome,
  { kind: 'succeeded' }
>;

export type FailedSeedanceTaskOutcome = Extract<
  NormalizedSeedanceTaskOutcome,
  { kind: 'failed' }
>;

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

export type GenerateAllClipPlan<T extends GenerateAllClipCandidate> =
  | { kind: 'parallel_heads'; clips: T[] }
  | { kind: 'single_fallback'; clip: T }
  | { kind: 'none' };

export const SUCCEEDED_MISSING_VIDEO_URL_REASON =
  'callback succeeded but video_url missing';
export const SUCCEEDED_VIDEO_PERSIST_FAILED_REASON =
  'callback succeeded but failed to persist video to R2';

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

export function buildQueuedGenerationPollWindow(
  now = new Date(),
): QueuedGenerationPollWindow {
  const nowMs = now.getTime();
  return {
    queryBefore: new Date(nowMs - 10 * 60 * 1000),
    expireBefore: new Date(nowMs - 30 * 60 * 1000),
  };
}

export function splitQueuedGenerationsForPolling<
  T extends Pick<video_clip_generations, 'createdAt' | 'seedanceTaskId'>,
>(
  generations: T[],
  window: Pick<QueuedGenerationPollWindow, 'expireBefore'>,
): QueuedGenerationPollQueues<T> {
  return {
    toExpire: generations.filter(
      (generation) => generation.createdAt < window.expireBefore,
    ),
    toPoll: generations.filter(
      (generation) =>
        generation.createdAt >= window.expireBefore &&
        Boolean(generation.seedanceTaskId),
    ),
  };
}

export function buildChainFirstFrameInput(input: {
  clipId: string;
  previousGeneration:
    | Pick<video_clip_generations, 'id' | 'lastFrameUrl'>
    | null
    | undefined;
  createdAt: Date;
}): ChainFirstFrameInput | null {
  if (!input.previousGeneration?.lastFrameUrl) return null;

  return {
    clipId: input.clipId,
    generationId: input.previousGeneration.id,
    lastFrameUrl: input.previousGeneration.lastFrameUrl,
    createdAt: input.createdAt,
  };
}

export function buildChainFirstFrameMaterial(
  input: ChainFirstFrameInput,
): VideoGenerationMaterial {
  return {
    id: 'chain_first_frame',
    clipId: input.clipId,
    role: VideoMaterialRole.first_frame,
    sourceType: VideoMaterialSourceType.video_generation,
    sourceId: input.generationId,
    url: input.lastFrameUrl,
    name: 'Auto from previous clip',
    metadata: null,
    createdAt: input.createdAt,
  };
}

export function resolveGenerationMaterials<T extends VideoGenerationMaterial>(
  materials: T[],
  chainFirstFrame?: ChainFirstFrameInput | null,
): Array<T | VideoGenerationMaterial> {
  if (!chainFirstFrame) return [...materials];

  return [
    buildChainFirstFrameMaterial(chainFirstFrame),
    ...materials.filter((material) => material.role !== VideoMaterialRole.first_frame),
  ];
}

export function resolveSucceededGenerationFailureReason(input: {
  sourceUrl: string | undefined;
  persistedVideoUrl?: string | null;
  persistAttempted?: boolean;
}): string | null {
  if (!input.sourceUrl) return SUCCEEDED_MISSING_VIDEO_URL_REASON;
  if (input.persistAttempted && !input.persistedVideoUrl) {
    return SUCCEEDED_VIDEO_PERSIST_FAILED_REASON;
  }
  return null;
}

export function resolveSucceededGenerationVideo(input: {
  sourceUrl: string | undefined;
  persistedVideoUrl?: string | null;
  persistAttempted?: boolean;
}): SucceededGenerationVideoResolution {
  const reason = resolveSucceededGenerationFailureReason(input);
  if (reason) return { kind: 'failed', reason };
  if (!input.persistedVideoUrl) {
    return { kind: 'failed', reason: SUCCEEDED_VIDEO_PERSIST_FAILED_REASON };
  }

  return { kind: 'ready', videoUrl: input.persistedVideoUrl };
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

export function buildPendingGenerationInput(input: {
  generationId: string;
  clipId: string;
  projectId: string;
  userId: string;
  variantLabel?: string;
  params: Pick<VideoGenerationClipParams, 'model'>;
  fallbackModel: string;
  resolvedPrompt: string;
  taskRequest: SeedanceTaskRequest;
}): PendingGenerationInput {
  return {
    generationId: input.generationId,
    clipId: input.clipId,
    projectId: input.projectId,
    userId: input.userId,
    variantLabel: input.variantLabel,
    model: input.params.model ?? input.fallbackModel,
    resolvedPrompt: input.resolvedPrompt,
    params: input.taskRequest as unknown as Prisma.InputJsonValue,
  };
}

export function buildCreateTaskFailureInput(input: {
  generationId: string;
  clipId: string;
  error: unknown;
}): Pick<FailedGenerationInput, 'generationId' | 'clipId' | 'error'> {
  return {
    generationId: input.generationId,
    clipId: input.clipId,
    error:
      input.error instanceof Error
        ? input.error.message
        : 'Unknown error creating task',
  };
}

export function buildCompletedGenerationInput(input: {
  generation: Pick<video_clip_generations, 'id' | 'clipId'>;
  outcome: SucceededSeedanceTaskOutcome;
  videoUrl: string;
}): CompletedGenerationInput {
  return {
    generationId: input.generation.id,
    clipId: input.generation.clipId,
    externalStatus: input.outcome.externalStatus,
    videoUrl: input.videoUrl,
    lastFrameUrl: input.outcome.lastFrameUrl,
    durationSec: input.outcome.durationSec,
  };
}

export function buildFailedGenerationInput(input: {
  generation: Pick<video_clip_generations, 'id' | 'clipId'>;
  outcome: FailedSeedanceTaskOutcome;
}): FailedGenerationInput {
  return {
    generationId: input.generation.id,
    clipId: input.generation.clipId,
    status: input.outcome.generationStatus,
    externalStatus: input.outcome.externalStatus,
    error: input.outcome.error,
  };
}

export function buildExplicitFailedGenerationInput(input: {
  generation: Pick<video_clip_generations, 'id' | 'clipId'>;
  reason: string;
  externalStatus: string;
}): FailedGenerationInput {
  return {
    generationId: input.generation.id,
    clipId: input.generation.clipId,
    status: VideoGenStatus.failed,
    externalStatus: input.externalStatus,
    error: input.reason,
  };
}

export function buildExpiredGenerationInput(input: {
  generation: Pick<video_clip_generations, 'id' | 'clipId'>;
  reason: string;
}): FailedGenerationInput {
  return {
    generationId: input.generation.id,
    clipId: input.generation.clipId,
    status: VideoGenStatus.expired,
    externalStatus: 'expired',
    error: input.reason,
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

export function resolveGenerateAllClipPlan<T extends GenerateAllClipCandidate>(
  clips: T[],
): GenerateAllClipPlan<T> {
  const heads = getPendingHeadClips(clips);
  if (heads.length > 0) {
    return { kind: 'parallel_heads', clips: heads };
  }

  const firstPending = getFirstPendingClip(clips);
  if (firstPending) {
    return { kind: 'single_fallback', clip: firstPending };
  }

  return { kind: 'none' };
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
