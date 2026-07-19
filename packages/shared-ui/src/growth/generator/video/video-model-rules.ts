import {
  acceptsVideoInputMedia,
  readVideoInputMedia,
  type VideoInputMediaCapability,
} from '@autix/domain/video';
import type { ParamsSchema } from '@autix/domain/pricing';

/**
 * 视频模型的输入媒体能力与参数约束 —— 前端侧的唯一读取口。
 *
 * 分两部分，边界是刻意的：
 *
 * 1. **能 schema 化的走 schema**（`x-media`，见 domain/video/input-media.ts）：
 *    接不接图/视频/音频、各自几个、多长。这类事实逐模型不同但形状一致，放 schema 里
 *    改运营配置就能生效，不用发版。
 *
 * 2. **schema 化不了的写在下面这张表**：各家把「什么条件下某参数才有效」写得千奇百怪
 *    （VEO lite 选 1080p 就只能 8 秒、Seedance 给了首帧后 ratio 由图决定…）。要把这些
 *    塞进 schema 得先发明一套条件表达式 DSL，那东西没人维护得了。规则一共就几条，
 *    写死在这里、逐条标注出处，比造 DSL 诚实。
 *
 * 两部分都只做**减法**：把上游必然拒绝的选项从 UI 上拿掉。任何时候读不到声明，
 * 一律按「不支持」处理 —— 与其让用户传上去再失败，不如一开始就不给入口。
 */

export type VideoMediaType = 'image' | 'video' | 'audio';

export interface VideoModelMediaLimits {
  /** 该模型允许上传/选择的媒体类型（顺序即 UI 展示顺序）。 */
  allowedTypes: VideoMediaType[];
  /** 各类型的数量上限。 */
  maxOf: Record<VideoMediaType, number>;
  /** 各类型的单个素材时长上限（秒）。undefined = 上游无明确限制，不拦。 */
  maxSecondsOf: Partial<Record<VideoMediaType, number>>;
  /** 图片必须恰好这么多张（Grok 1.5）。undefined = 0..max 均可。 */
  exactImages?: number;
  /** 参与选择的素材总数上限：喂给资产面板做整体截断。 */
  totalMax: number;
}

const NO_MEDIA: VideoModelMediaLimits = {
  allowedTypes: [],
  maxOf: { image: 0, video: 0, audio: 0 },
  maxSecondsOf: {},
  totalMax: 0,
};

/**
 * 从模型的 paramsSchema 解析输入媒体能力。
 *
 * 读不到 x-media 时返回「只接图片、上限 1」而不是全集：老数据（seed 还没跑过的库）
 * 落到这里时，给一个所有视频模型都成立的最小交集，总好过给出必然失败的视频/音频入口。
 */
export function resolveVideoMediaLimits(
  paramsSchema: ParamsSchema | undefined,
): VideoModelMediaLimits {
  const media = readVideoInputMedia(paramsSchema);
  if (!media) {
    return {
      allowedTypes: ['image'],
      maxOf: { image: 1, video: 0, audio: 0 },
      maxSecondsOf: {},
      totalMax: 1,
    };
  }
  return buildLimits(media);
}

function buildLimits(media: VideoInputMediaCapability): VideoModelMediaLimits {
  const allowedTypes = (['image', 'video', 'audio'] as VideoMediaType[]).filter((type) =>
    acceptsVideoInputMedia(media, type),
  );
  if (allowedTypes.length === 0) return NO_MEDIA;

  const maxOf: Record<VideoMediaType, number> = {
    image: media.image?.max ?? 0,
    video: media.video?.max ?? 0,
    audio: media.audio?.max ?? 0,
  };
  const maxSecondsOf: Partial<Record<VideoMediaType, number>> = {};
  if (media.video?.maxSeconds) maxSecondsOf.video = media.video.maxSeconds;
  if (media.audio?.maxSeconds) maxSecondsOf.audio = media.audio.maxSeconds;

  return {
    allowedTypes,
    maxOf,
    maxSecondsOf,
    ...(media.image?.exact ? { exactImages: media.image.exact } : {}),
    totalMax: maxOf.image + maxOf.video + maxOf.audio,
  };
}

// ---------------------------------------------------------------------------
// 下面是 schema 表达不了、按上游文档写死的条件约束
// ---------------------------------------------------------------------------

export interface VideoParamContext {
  /** 当前选中的分辨率。 */
  resolution?: string;
  /** 已选中的图片数量。 */
  imageCount: number;
}

interface VideoModelRule {
  /**
   * 在给定上下文下，duration 被收窄到哪几个值。返回 undefined 表示不收窄。
   * 只做减法：返回值一定是 schema enum 的子集，由调用方取交集。
   */
  restrictDurations?: (ctx: VideoParamContext) => number[] | undefined;
  /**
   * 该模型在给定上下文下，画幅比参数是否**实际生效**。返回 false 时 UI 应禁用并说明原因
   * —— 参数还留在那儿但点了没用，比直接藏掉更让人困惑。
   */
  ratioApplies?: (ctx: VideoParamContext) => boolean;
}

/**
 * 逐模型的条件约束。key 是 model-id（与 seed 的 VIDEO_MODEL_CONFIGS 同一套）。
 * 每条都标了文档出处，改之前先回去核对，别凭印象调。
 */
const VIDEO_MODEL_RULES: Record<string, VideoModelRule> = {
  // VEO 3.1 lite（poyo 文档「约束条件详解」）：
  //   - lite + 1080p → "supports 8 seconds only"
  //   - lite + 2 图（首尾帧）→ "duration 8 only"
  'veo3.1-lite-official': {
    restrictDurations: ({ resolution, imageCount }) =>
      resolution === '1080p' || imageCount >= 2 ? [8] : undefined,
  },
  // VEO 3.1 fast/quality：参考模式（3 图）→ "8 seconds only"
  'veo3.1-fast-official': {
    restrictDurations: ({ imageCount }) => (imageCount >= 3 ? [8] : undefined),
  },
  'veo3.1-quality-official': {
    restrictDurations: ({ imageCount }) => (imageCount >= 3 ? [8] : undefined),
  },
  // Grok Imagine（poyo 文档）：aspect_ratio 标注 "text-to-video only"，
  // 一旦带图就是 image-to-video，比例由图决定。
  'grok-imagine': {
    ratioApplies: ({ imageCount }) => imageCount === 0,
  },
  // Seedance 2.0 / Fast（amux 文档）：ratio "overridden by first frame aspect ratio when present"
  'doubao-seedance-2.0': {
    ratioApplies: ({ imageCount }) => imageCount === 0,
  },
  'doubao-seedance-2.0-fast': {
    ratioApplies: ({ imageCount }) => imageCount === 0,
  },
};

/**
 * 在 schema 给出的候选时长上再套一层条件约束。
 * 交集为空时返回原候选 —— 宁可让用户选到一个可能被拒的值，也不能给出一个空的选择器。
 */
export function restrictVideoDurations(
  modelId: string | undefined,
  durations: number[],
  ctx: VideoParamContext,
): number[] {
  const restricted = modelId ? VIDEO_MODEL_RULES[modelId]?.restrictDurations?.(ctx) : undefined;
  if (!restricted) return durations;
  const allowed = durations.filter((value) => restricted.includes(value));
  return allowed.length > 0 ? allowed : durations;
}

/** 当前上下文下画幅比是否生效（缺省视为生效）。 */
export function videoRatioApplies(
  modelId: string | undefined,
  ctx: VideoParamContext,
): boolean {
  const rule = modelId ? VIDEO_MODEL_RULES[modelId] : undefined;
  return rule?.ratioApplies?.(ctx) ?? true;
}

/** 图片数量是否满足该模型要求（Grok 1.5 要求恰好 1 张）。 */
export function videoImageCountSatisfied(
  limits: VideoModelMediaLimits,
  imageCount: number,
): boolean {
  if (limits.exactImages !== undefined) return imageCount === limits.exactImages;
  return imageCount <= limits.maxOf.image;
}
