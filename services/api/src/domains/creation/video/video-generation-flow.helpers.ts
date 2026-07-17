import {
  VideoClipStatus,
  VideoGenStatus,
  VideoMaterialRole,
  VideoMaterialSourceType,
  type Prisma,
  type video_clip_generations,
  type video_clip_materials,
} from '../../platform/prisma/generated';
import type { SeedanceContentItem } from './seedance-api.service';
import {
  normalizeVideoResolution as normalizeDomainVideoResolution,
  normalizeVideoResolutionForModel,
  toUnifiedVideoParams,
  type VideoGenerationClipParams,
  type VideoModelHint,
  type VideoResolution,
} from '@autix/domain/video';
import {
  getSeedanceDuration,
  getSeedanceErrorMessage,
  getSeedanceLastFrameUrl,
  getSeedanceStatus,
  getSeedanceVideoUrl,
  type SeedanceTaskPayload,
} from './seedance-task-payload';

export type { VideoGenerationClipParams };

export interface StoryboardVideoPromptClip {
  order: number;
  title?: string | null;
  prompt?: string | null;
}

export type NormalizedVideoResolution = VideoResolution;

export interface VideoGenerationRequestLimits {
  resolution: NormalizedVideoResolution;
  durationSeconds: number;
}

export interface SeedanceContentSummary {
  referenceImages: number;
  hasVideoInput: boolean;
  hasAudioInput: boolean;
}

/**
 * Shape consumed directly as `TaskEstimateInput` (Task 3/4). Video params are all
 * order-time `params` sourced from the `video` pricing preset's paramsSchema
 * (resolution/seconds/ratio — see packages/domain/src/pricing/presets.ts) — video
 * has no token/usage-source pricing, so there is no `usage` field here.
 */
export interface SeedanceCostEstimateInput {
  taskType: string;
  modelConfigId?: string;
  params: {
    resolution: NormalizedVideoResolution;
    seconds: number;
    ratio?: string;
  };
  membershipLevel?: number;
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
export const VIDEO_GENERATION_TASK_TYPE = 'video_generation';

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

export function resolveStoryboardVideoPrompt(input: {
  clips: StoryboardVideoPromptClip[];
  params: Pick<VideoGenerationClipParams, 'generationMode' | 'storyboardPrompt'>;
}): string {
  if (input.params.generationMode !== 'storyboard') {
    return resolveClipPrompt(input.clips[0]?.prompt ?? null, input.params);
  }

  const storyboardPrompt =
    typeof input.params.storyboardPrompt === 'string'
      ? input.params.storyboardPrompt.trim()
      : '';
  const storyboardLines = [...input.clips]
    .sort((a, b) => a.order - b.order)
    .map((clip) => {
      const title = clip.title?.trim();
      const prompt = clip.prompt?.trim();
      return [
        `分镜 ${clip.order}${title ? `「${title}」` : ''}`,
        prompt ? `：${prompt}` : '',
      ].join('');
    })
    .filter(Boolean);

  return [
    storyboardPrompt ? `整片提示词：${storyboardPrompt}` : '',
    storyboardLines.length > 0
      ? `完整分镜脚本：\n${storyboardLines.join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function normalizeVideoResolution(
  value: string | undefined,
): NormalizedVideoResolution {
  return normalizeDomainVideoResolution(value);
}

export function normalizeVideoDuration(value: number | undefined): number {
  const duration = Number(value ?? 5);
  if (!Number.isFinite(duration) || duration <= 0) return 5;
  return Math.ceil(duration);
}

export function resolveStoryboardTotalDuration(
  clips: Array<{ params: unknown }>,
  fallback?: number,
): number {
  const total = clips.reduce((sum, clip) => {
    const params =
      clip.params && typeof clip.params === 'object' && !Array.isArray(clip.params)
        ? (clip.params as Record<string, unknown>)
        : {};
    const duration = Number(params.duration);
    return Number.isFinite(duration) && duration > 0 ? sum + duration : sum;
  }, 0);
  return total > 0 ? Math.ceil(total) : normalizeVideoDuration(fallback);
}

export function resolveVideoGenerateAudio(
  params: Pick<VideoGenerationClipParams, 'generateAudio' | 'generate_audio'>,
): boolean | undefined {
  return params.generateAudio ?? params.generate_audio;
}

export function resolveVideoGenerationRequestLimits(
  params: Pick<VideoGenerationClipParams, 'resolution' | 'duration'>,
  model?: VideoModelHint | null,
): VideoGenerationRequestLimits {
  return {
    resolution: normalizeVideoResolutionForModel(params.resolution, model),
    durationSeconds: normalizeVideoDuration(params.duration),
  };
}

export function normalizeVideoGenerationClipParamsForModel(
  params: VideoGenerationClipParams,
  model?: VideoModelHint | null,
): VideoGenerationClipParams {
  return {
    ...params,
    resolution: normalizeVideoResolutionForModel(params.resolution, model),
  };
}

export function resolveVideoPricingTaskType(
  _params: Pick<VideoGenerationClipParams, 'resolution'>,
  _model: string,
): string {
  return VIDEO_GENERATION_TASK_TYPE;
}

export function buildSeedanceTaskRequestOptions(input: {
  params: VideoGenerationClipParams;
  model: string;
  content: SeedanceContentItem[];
  callbackUrl?: string;
  returnLastFrame: boolean;
}): SeedanceTaskRequestOptions {
  return {
    // FIX-3: 始终使用服务端解析/鉴权过的模型，忽略客户端传入的 params.model，
    // 防止"选便宜模型过鉴权、用 params.model 偷换为贵模型"导致跑贵付便宜。
    model: input.model,
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
    expireBefore: new Date(nowMs - 30 * 60 * 1000),
  };
}

export function splitQueuedGenerationsForPolling<
  T extends Pick<video_clip_generations, 'createdAt' | 'providerTaskId'>,
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
        Boolean(generation.providerTaskId),
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
  params: Pick<
    VideoGenerationClipParams,
    'resolution' | 'duration' | 'ratio' | 'sourceTemplateId' | 'sourceTemplateKind'
  >;
  modelConfigId?: string;
  membershipLevel?: number;
}): SeedanceCostEstimateInput {
  // 先经唯一投影拿到统一词汇（duration → seconds），再套计价自己的归一化。
  // 归一化必须留在这里：上游请求体发的是原值，投影若归一化会改变实际生成参数。
  const unified = toUnifiedVideoParams(input.params);
  return {
    taskType: VIDEO_GENERATION_TASK_TYPE,
    ...(input.modelConfigId !== undefined ? { modelConfigId: input.modelConfigId } : {}),
    params: {
      resolution: normalizeVideoResolution(unified.resolution),
      seconds: normalizeVideoDuration(unified.seconds),
      ...(unified.ratio !== undefined ? { ratio: unified.ratio } : {}),
    },
    ...(input.membershipLevel !== undefined ? { membershipLevel: input.membershipLevel } : {}),
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
  projectId: string;
  clipId: string;
  modelConfigId: string;
  // 计划 4：调用方现在传入引擎 assembleVideoRequest 的输出（Ark 请求体快照），
  // 不再是 SeedanceApiService.buildTaskRequest 的返回值 —— 两者字段形状经 golden
  // 测试锁定等价，但类型上不再是同一个具名接口，故放宽为 JSON 快照类型。
  taskRequest: Record<string, unknown>;
}): VideoHoldInput {
  return {
    taskType: input.billingTaskType,
    taskId: input.generationId,
    amount: input.estimatedCost,
    pricingSnapshot: toPrismaInputJson(input.pricingSnapshot),
    // refundPolicy is dead (Task 15 brief: 39 old rules all NULL, refundHold
    // never reads refundPolicySnapshot) — createHold's param is optional, so we
    // simply never populate it here rather than fabricate `{}`.
    metadata: toPrismaInputJson({
      projectId: input.projectId,
      clipId: input.clipId,
      modelConfigId: input.modelConfigId,
      seedanceTaskRequest: input.taskRequest,
    }),
    remark: input.billingTaskType === VIDEO_GENERATION_TASK_TYPE
      ? 'video-generation'
      : `video-generation:${input.billingTaskType}`,
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
  // 计划 4：见 buildVideoHoldInput 同名字段注释。
  taskRequest: Record<string, unknown>;
}): PendingGenerationInput {
  return {
    generationId: input.generationId,
    clipId: input.clipId,
    projectId: input.projectId,
    userId: input.userId,
    variantLabel: input.variantLabel,
    // FIX-3: 记录服务端解析的模型，不采信客户端 params.model。
    model: input.fallbackModel,
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
