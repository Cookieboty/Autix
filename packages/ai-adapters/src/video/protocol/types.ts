import type { VideoMaterialRole } from '@autix/domain/video';

/** 错误分类。与 image 侧同构（image/protocol/types.ts:10）。 */
export type ErrorClassification =
  | 'params'
  | 'auth'
  | 'rate-limit'
  | 'content-policy'
  | 'timeout'
  | 'upstream';

/**
 * 内部统一终态词汇。目标端是既有的 VideoGenStatus 与
 * normalizeSeedanceTaskOutcome 的四种 kind —— 不新发明词汇。
 */
export type VideoTaskOutcomeKind = 'active' | 'succeeded' | 'failed' | 'expired';

/**
 * 取值 path 候选链：按序取第一个命中的。
 *
 * 为什么必须是候选链而非单个 path：现有 getStringField
 * （services/api/.../seedance-task-payload.ts:9-19）读 video_url 时是**两级回退** ——
 * 先顶层 `video_url`，未命中再 `content.video_url`；last_frame_url 同理。
 * 这是从现有实现翻译出的真实约束，不是预留。
 */
export type PathCandidates = string | string[];

/**
 * 参数绑定。
 *
 * 省略语义必须精确到能复刻 Ark 的 buildTaskRequest
 * （services/api/.../seedance-api.service.ts:288-303），它有**四种**不同的省略：
 *   if (opts.callbackUrl) ...                              → 'falsy'
 *   if (opts.generateAudio !== undefined) ...              → 'undefined'（false 会发！）
 *   if (opts.duration !== undefined) ...                   → 'undefined'（0 会发）
 *   if (opts.seed !== undefined && opts.seed !== -1) ...   → 'undefined' + omitValues:[-1]
 * image 侧的 `omitWhen: 'empty'` 一种都表达不了 —— 这正是视频用自己的
 * BindingSpec（方案 A/独立类型）而非复用 image 类型的价值。
 */
export interface VideoBindingSpec {
  /** 写入请求体的 JSON path。语法见 core 的 setPath。 */
  path: string;
  /** 值映射表（统一值 → 厂商原生值）。 */
  valueMap?: Record<string, string>;
  /** 'undefined'：仅 undefined 省略（false/0 照发）；'falsy'：所有假值省略。缺省 = 恒发。 */
  omitWhen?: 'undefined' | 'falsy';
  /** 额外的哨兵省略值（如 seed 的 -1）。与 omitWhen 为「或」关系。 */
  omitValues?: readonly unknown[];
}

/**
 * 一个素材角色在 wire 上的形态。
 *
 * 为什么按 role 而非按媒体类型分：Ark 的 buildContent
 * （seedance-api.service.ts:127-165）就是按 role 分发的 —— first_frame /
 * last_frame / reference_image 走 image_url，reference_video 走 video_url，
 * reference_audio 走 audio_url。role 同时决定 item 的 type 与 url 字段。
 */
export interface RoleItemSpec {
  /** ContentItem 的 type 值，如 'image_url'。 */
  type: string;
  /** 承载 { url } 的字段名，如 'image_url'。 */
  urlField: string;
  /** 写进 roleField 的值，如 'first_frame'。 */
  role: string;
}

/**
 * prompt + 素材如何组装进请求体。
 *
 * 联合里只有一个成员，这是刻意的（设计 §4.3）：只有 Ark 一家真实样本，
 * 第二个成员等第二家渠道的真实文档到手再加 —— 那是增量改动。
 * 凭空加投机成员等于把猜测固化进类型。
 */
export type ContentBinding = {
  strategy: 'typed-content-items';
  /** content 数组写入的 path，如 'content'。 */
  path: string;
  /** prompt 的 item 形态。prompt 为空时**不写入**（对齐 buildContent 的 `if (prompt)`）。 */
  textItem: { type: string; field: string };
  /** 每个素材角色的 wire 形态。必须覆盖 VideoMaterialRole 的全部取值。 */
  roleItems: Record<VideoMaterialRole, RoleItemSpec>;
  /** 角色字段名，如 'role'。 */
  roleField: string;
};

export interface SubmitSpec {
  endpoint: { method: 'POST'; path: string };
  /** 模型写入位置。 */
  model: VideoBindingSpec;
  content: ContentBinding;
  /** key 必须是 UNIFIED_VIDEO_PARAM_KEYS 里的统一参数名（跨配置校验器据此闭合）。 */
  paramBindings: Record<string, VideoBindingSpec>;
  /** 恒定写入的字段。 */
  staticBody?: Record<string, unknown>;
  /** 从**提交响应**取任务 id 的 path 候选链。与 WebhookSpec.taskIdPath 是两件事。 */
  taskIdPath: PathCandidates;
}

export interface QuerySpec {
  /** path 里的 `{taskId}` 由引擎注入。 */
  endpoint: { method: 'GET'; path: string };
}

/** query 响应与 callback 体共用的取值规则。 */
export interface ResultSpec {
  statusPath: PathCandidates;
  /** 厂商状态字典 → 内部词汇。未命中的状态归为 'active' 并告警（见 normalizeVideoOutcome）。 */
  statusMap: Record<string, VideoTaskOutcomeKind>;
  videoUrlPath: PathCandidates;
  lastFrameUrlPath?: PathCandidates;
  durationPath?: PathCandidates;
  errorMessagePath?: PathCandidates;
}

/**
 * 回调验签。
 *
 * 仅一个成员：建模现有的 query-token 方案（video-callback.handler.ts:33-42 +
 * video-callback-url.builder.ts:13-15）。**这不是占位** —— 现网就是这么做的，
 * 且带 fail-closed。bearer/hmac 等成员等首家需要它们的渠道落地再加（增量改动）。
 */
export type WebhookVerification = {
  kind: 'query-token';
  /** query 参数名，如 'token'。 */
  param: string;
  /** 密钥的**环境变量名**。密钥本身不进 DB、不进 preset 字面量。 */
  secretRef: string;
};

export interface WebhookSpec {
  /** 回调地址写进提交 body 的位置。 */
  callbackUrlBinding: VideoBindingSpec;
  /** 从**回调体**取任务 id 的 path 候选链。 */
  taskIdPath: PathCandidates;
  verification: WebhookVerification;
  /** 回调体与 query 响应不同构时单独声明；缺省复用 preset.result。 */
  result?: ResultSpec;
}

export interface VideoProtocolPreset {
  key: string;
  transport: 'async-poll';
  /** 传给 safeFetch 的超时。注意它只约束「拿到响应头」，不约束调用方读 body。 */
  timeoutMs: number;
  auth: { in: 'header' | 'query'; name: string; template: string };
  submit: SubmitSpec;
  query: QuerySpec;
  result: ResultSpec;
  /** 缺省 = 该渠道不支持回调 → 纯靠轮询收敛（既有双通道天然支持，无需额外分支）。 */
  webhook?: WebhookSpec;
  /** key 为 HTTP 状态码或 '*'。 */
  errorMapping: Record<string, ErrorClassification>;
}

/** 一个待组装的素材。引擎只认 role + url，不认识 Prisma。 */
export interface VideoMaterialInput {
  role: VideoMaterialRole;
  url: string;
}

export interface VideoCallRequest {
  preset: VideoProtocolPreset;
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt?: string | null;
  materials: VideoMaterialInput[];
  /** 已经过 toUnifiedVideoParams 投影的统一参数。引擎不认识 clip 词汇。 */
  params: Record<string, unknown>;
  /** 完整回调地址（含 token）。缺省则不注入 callback_url。 */
  callbackUrl?: string;
}

/** 归一化后的终态。对齐既有 normalizeSeedanceTaskOutcome 的四种 kind。 */
export type VideoTaskOutcome =
  | { kind: 'missing_status' }
  | { kind: 'active'; externalStatus: string }
  | {
      kind: 'succeeded';
      externalStatus: string;
      sourceUrl?: string;
      lastFrameUrl: string | null;
      durationSec: number | null;
    }
  | {
      kind: 'failed' | 'expired';
      externalStatus: string;
      error: string;
    };

/**
 * 上游调用失败。分类由 preset 的 errorMapping 声明，取代「从错误消息里正则反推
 * 状态码」的老做法。
 *
 * `message` 只放英文诊断串（进日志）。**不写死中文文案** —— 面向用户的文案由
 * api-service 的 i18n 决定。`upstreamBody` 是截断后的上游原文，进日志不进 UI。
 */
export class VideoUpstreamError extends Error {
  readonly classification: ErrorClassification;
  readonly httpStatus?: number;
  readonly retryable: boolean;
  readonly upstreamBody?: string;
  readonly endpoint?: string;
  readonly requestId?: string;

  constructor(init: {
    message: string;
    classification: ErrorClassification;
    httpStatus?: number;
    retryable: boolean;
    upstreamBody?: string;
    endpoint?: string;
    requestId?: string;
  }) {
    super(init.message);
    this.name = 'VideoUpstreamError';
    this.classification = init.classification;
    this.httpStatus = init.httpStatus;
    this.retryable = init.retryable;
    this.upstreamBody = init.upstreamBody;
    this.endpoint = init.endpoint;
    this.requestId = init.requestId;
  }
}
