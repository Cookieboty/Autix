import {
  VideoClipStatus,
  VideoGenStatus,
  VideoMaterialRole,
  VideoMaterialSourceType,
  type GenerationErrorStage,
  type Prisma,
  type video_clip_generations,
  type video_clip_materials,
} from '../../platform/prisma/generated';
import {
  fromUnknown,
  fromVideoUpstreamError,
  type GenerationFailure,
} from '../../platform/generation-tasks/generation-failure';
import {
  normalizeVideoResolution as normalizeDomainVideoResolution,
  normalizeVideoResolutionForModel,
  toUnifiedVideoParams,
  type VideoGenerationClipParams,
  type VideoModelHint,
  type VideoResolution,
} from '@autix/domain/video';
import { readProtocolKey } from '@autix/domain/model';
import {
  resolveVideoPreset,
  resolveWanMode,
  VideoUpstreamError,
  type VideoProtocolPreset,
} from '@autix/ai-adapters/video';

export type { VideoGenerationClipParams };

/**
 * 把提交/查询抛出的异常转成 `GenerationFailure`，尽量保住上游的结构化字段
 * （httpStatus / requestId / body / classification）——这些一旦被压成 `err.message`
 * 就再也回不来了。
 *
 * `stage` **必须由调用方显式传入**：绝不能从 `callbackReceivedAt` 之类的列反推，
 * 那一列被轮询路径也无条件写入，语义与列名不符，据此归因会系统性地错。
 */
export function toVideoGenerationFailure(
  err: unknown,
  stage: GenerationErrorStage,
): GenerationFailure {
  return err instanceof VideoUpstreamError
    ? fromVideoUpstreamError(err, stage)
    : fromUnknown(err, stage);
}

/**
 * 把「上游已归一化的终态失败」转成 `GenerationFailure`。与 `toVideoGenerationFailure`
 * 的区别：这里没有异常对象可拆（outcome 是解析后的结构），只有错误串与上游状态串。
 */
export function toVideoOutcomeFailure(input: {
  stage: GenerationErrorStage;
  error: string;
  externalStatus?: string;
}): GenerationFailure {
  return {
    stage: input.stage,
    message: input.error,
    code: input.externalStatus,
  };
}

/**
 * 视频提交路由:把 (模型配置, 素材) 解析成实际要用的 preset 与上游 model ID。
 *
 * - 常规模型:静态 —— `protocolKey → preset`、上游 model ID = 行的 `model`(与旧逻辑逐字等价)。
 * - Wan 2.7(`metadata.videoDispatch === 'wan'`):**一个模型**,上游按素材角色分到 t2v/i2v/ref,
 *   故在此按素材覆盖 preset 与 model ID(见 resolveWanMode)。计费四模式统一,覆盖 model ID
 *   仍是服务端权威、价格恒等,不违反 FIX-3。
 *
 * 派发信号用**专用键 `videoDispatch`** 而非 `modelFamily`:后者按约定「仅展示、代码里不得
 * switch(modelFamily)」(image-metadata.types.ts)。`protocolKey` 保持真 preset(poyo-wan-t2v@v1),
 * 让非派发路径(legacy 查询/刷新)仍能正常解析。
 *
 * `maxDurationSeconds` 仅 Wan 会返回(各模式时长上限不同),调用方据此在打上游前拦超范围的 duration。
 */
export interface VideoRouting {
  preset: VideoProtocolPreset;
  model: string;
  maxDurationSeconds?: number;
}

export function resolveVideoRouting(
  metadata: unknown,
  baseModel: string,
  materialRoles: readonly string[],
): VideoRouting {
  const dispatch = (metadata as { videoDispatch?: unknown } | null | undefined)?.videoDispatch;
  if (dispatch === 'wan') {
    const wan = resolveWanMode(materialRoles);
    return {
      preset: resolveVideoPreset(wan.protocolKey),
      model: wan.modelId,
      maxDurationSeconds: wan.maxDurationSeconds,
    };
  }
  return { preset: resolveVideoPreset(readProtocolKey(metadata)), model: baseModel };
}

// 计划 4 Task 4：类型原定义于已删除的 seedance-api.service.ts。仍被
// summarizeSeedanceContent 使用（该函数不在本次删除范围内），故就地保留定义。
export interface SeedanceContentItem {
  type: 'text' | 'image_url' | 'video_url' | 'audio_url';
  text?: string;
  image_url?: { url: string };
  video_url?: { url: string };
  audio_url?: { url: string };
  role?: string;
}

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
 * (resolution/duration/ratio — 火山原生名，见 packages/domain/src/pricing/presets.ts)
 * — video has no token/usage-source pricing, so there is no `usage` field here.
 */
export interface SeedanceCostEstimateInput {
  taskType: string;
  modelConfigId?: string;
  params: {
    resolution: NormalizedVideoResolution;
    duration: number;
    ratio?: string;
    // 计价维度：部分渠道（PoYo VEO）按「分辨率 × 是否出声」定每秒单价，pricingSchema 的
    // `when` 谓词读 generate_audio。缺了它 → 音频维度静默按无声计价 → 少收费。
    generate_audio?: boolean;
  };
  membershipLevel?: number;
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
  clipId: string | null;
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
  clipId: string | null;
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
    storyboardPrompt ? `Full video prompt: ${storyboardPrompt}` : '',
    clipPrompt ? `Current shot prompt: ${clipPrompt}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function resolveStoryboardVideoPrompt(input: {
  clips: StoryboardVideoPromptClip[];
  params: Pick<VideoGenerationClipParams, 'generationMode' | 'storyboardPrompt'>;
}): string {
  const storyboardPrompt =
    typeof input.params.storyboardPrompt === 'string'
      ? input.params.storyboardPrompt.trim()
      : '';

  // 单条 clip 且无整片提示词：直接发用户原始 prompt，**不套「完整分镜脚本 / 分镜 N」脚手架**。
  // generateAllClips 会对整个项目（哪怕只有 1 条 clip）强制 generationMode='storyboard'，
  // 于是原本一句「骑摩托的妹子」会被包成「完整分镜脚本：\n分镜 1「骑摩托的妹子」：骑摩托的妹子」。
  // 分镜脚手架只对真正的多分镜项目有意义；单条生成必须原样透传。
  if (input.clips.length <= 1 && !storyboardPrompt) {
    return input.clips[0]?.prompt?.trim() ?? '';
  }

  if (input.params.generationMode !== 'storyboard') {
    return resolveClipPrompt(input.clips[0]?.prompt ?? null, input.params);
  }

  const storyboardLines = [...input.clips]
    .sort((a, b) => a.order - b.order)
    .map((clip) => {
      const title = clip.title?.trim();
      const prompt = clip.prompt?.trim();
      return [
        `Shot ${clip.order}${title ? ` "${title}"` : ''}`,
        prompt ? `: ${prompt}` : '',
      ].join('');
    })
    .filter(Boolean);

  return [
    storyboardPrompt ? `Full video prompt: ${storyboardPrompt}` : '',
    storyboardLines.length > 0
      ? `Full storyboard script:\n${storyboardLines.join('\n')}`
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

export function buildQueuedGenerationPollWindow(
  now = new Date(),
): QueuedGenerationPollWindow {
  const nowMs = now.getTime();
  return {
    // 65min：晚于积分侧孤儿回收的 60min 退款窗口。排水只负责把无人认领的任务排出轮询
    // 队列（防队列被卡死任务占满），退款是积分域的职责（PointsHoldReclaimCron）。
    expireBefore: new Date(nowMs - 65 * 60 * 1000),
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

/**
 * 计算轮询单次查询耗时的 p50/p95，用于批次聚合日志。
 * 空数组返回 0，避免除零；使用 nearest-rank 简化实现（样本量小时够用）。
 * 拆出来是为了可以在 helpers.spec 里加确定性测试，不需要拉起整个 service。
 */
export function summarizeDurations(
  durations: readonly number[],
): { p50: number; p95: number } {
  if (durations.length === 0) return { p50: 0, p95: 0 };
  const sorted = [...durations].sort((a, b) => a - b);
  const pick = (p: number): number => {
    const idx = Math.min(
      sorted.length - 1,
      Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
    );
    return sorted[idx] ?? 0;
  };
  return { p50: pick(50), p95: pick(95) };
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
    | 'resolution'
    | 'duration'
    | 'ratio'
    | 'generateAudio'
    | 'generate_audio'
    | 'sourceTemplateId'
    | 'sourceTemplateKind'
  >;
  modelConfigId?: string;
  membershipLevel?: number;
}): SeedanceCostEstimateInput {
  // 先经唯一投影拿到火山原生参数（duration 直接透传），再套计价自己的归一化。
  // 归一化必须留在这里：上游请求体发的是原值，投影若归一化会改变实际生成参数。
  const native = toUnifiedVideoParams(input.params);
  return {
    taskType: VIDEO_GENERATION_TASK_TYPE,
    ...(input.modelConfigId !== undefined ? { modelConfigId: input.modelConfigId } : {}),
    params: {
      resolution: normalizeVideoResolution(native.resolution),
      duration: normalizeVideoDuration(native.duration),
      ...(native.ratio !== undefined ? { ratio: native.ratio } : {}),
      ...(native.generate_audio !== undefined ? { generate_audio: native.generate_audio } : {}),
    },
    ...(input.membershipLevel !== undefined ? { membershipLevel: input.membershipLevel } : {}),
  };
}

export function toPrismaInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

/**
 * 脱敏 provider 请求体里的 `callback_url` —— 它带 `?token=<VIDEO_CALLBACK_SECRET>`，
 * 任何拿到日志或 DB 只读权限的人凭它就能伪造回调、驱动状态与扣费。请求体本身仍带真实
 * callback_url 发给上游；**只有落日志/落库前**用本函数换成占位。返回浅拷贝，不改原对象。
 *
 * 注意本函数**保留 prompt**：落库快照（hold metadata / paramsSnapshot）需要能复现这次
 * 生成，而 prompt 本就存在业务表里，抹掉只损失可复现性、没有隐私收益。
 * 落日志请改用 {@link redactProviderRequestForLog}。
 */
export function redactProviderRequest(
  body: Record<string, unknown>,
): Record<string, unknown> {
  if (!body || typeof body !== 'object' || !('callback_url' in body)) return body;
  return { ...body, callback_url: '[REDACTED]' };
}

/** 用户 prompt 的落点：typed 策略是 content[].text，flat-media 是 input.prompt（见 vendors.ts）。 */
const PROMPT_KEYS: ReadonlySet<string> = new Set(['prompt', 'text']);

function redactPromptsDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactPromptsDeep);
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (key === 'callback_url' && typeof val === 'string') {
      out[key] = '[REDACTED]';
    } else if (PROMPT_KEYS.has(key) && typeof val === 'string') {
      // 保留长度：排障时"prompt 是不是空/超长"是最常问的问题，内容本身不需要。
      out[key] = `[REDACTED:len=${val.length}]`;
    } else {
      out[key] = redactPromptsDeep(val);
    }
  }
  return out;
}

/**
 * 落日志专用脱敏：在 {@link redactProviderRequest} 的基础上，额外抹掉用户 prompt
 * （任意层级的 `prompt` / `text` 字符串字段），只保留长度。
 *
 * 按字段名而非固定路径匹配，是为了让新增 protocol preset 默认被覆盖，而不是默认泄露。
 * 返回深拷贝，不改原对象。
 */
export function redactProviderRequestForLog(
  body: Record<string, unknown>,
): Record<string, unknown> {
  if (!body || typeof body !== 'object') return body;
  return redactPromptsDeep(body) as Record<string, unknown>;
}

export function buildVideoHoldInput(input: {
  billingTaskType: string;
  generationId: string;
  estimatedCost: number;
  pricingSnapshot: unknown;
  projectId: string | null;
  clipId: string | null;
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
      // 快照排除 callback token（含 VIDEO_CALLBACK_SECRET），DB 只读泄露也不能伪造回调。
      seedanceTaskRequest: redactProviderRequest(input.taskRequest),
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
}): { generationId: string; clipId: string; error: string } {
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
  /**
   * 转存到 R2 之后的末帧地址。必传（可为 null）——**不要**回退到
   * `outcome.lastFrameUrl`：那是供应商的 24h 临时链接，会被当成素材库封面和链式
   * 生成的输入图存进库，一天后集体失效。转存失败就落 null，宁可没封面也不留死链。
   */
  lastFrameUrl: string | null;
}): CompletedGenerationInput {
  return {
    generationId: input.generation.id,
    clipId: input.generation.clipId,
    externalStatus: input.outcome.externalStatus,
    videoUrl: input.videoUrl,
    lastFrameUrl: input.lastFrameUrl,
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

export function buildDirectGenerationParamsSnapshot(input: {
  options: { resolution?: string; ratio?: string; duration?: number; generateAudio?: boolean };
  materials: Array<{ role: string; url: string; sourceType?: string; name?: string | null }>;
  providerRequest: Record<string, unknown>;
}): Prisma.InputJsonValue {
  return toPrismaInputJson({
    schemaVersion: 1,
    mode: 'direct',
    options: input.options,
    materials: input.materials,
    // 快照排除 callback token（含 VIDEO_CALLBACK_SECRET）。
    providerRequest: redactProviderRequest(input.providerRequest),
  });
}
