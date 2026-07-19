import type { ImageOperation } from '@autix/domain/model';

// Re-export ImageOperation from domain
export type { ImageOperation } from '@autix/domain/model';

/** Wire transport shape for a protocol preset */
export type Transport = 'sync-json' | 'multipart' | 'async-poll' | 'sse';

/** Error classification for upstream errors */
export type ErrorClassification =
  | 'params'
  | 'auth'
  | 'rate-limit'
  | 'content-policy'
  | 'timeout'
  | 'upstream';

/** Valid transform function names */
export type TransformKey = 'stripTierSuffix';

/**
 * 复合绑定产出像素尺寸串（`WxH`）时，上游对该尺寸的硬性约束。逐 preset 声明，因为它们
 * 是各上游端点自己的契约，各家不同：
 * - gpt-image-2：边≤3840、16 倍数、长短边≤3:1、像素∈[655360, 8294400]。
 * - Seedream 4.5 / 5.0-lite：像素∈[3686400, 16777216]、长短边∈[1/16,16]；**无** 16 倍数、**无** 边上限。
 * 故 `maxEdge` / `edgeMultipleOf` 可选（某家没有这条约束就不声明）。声明后由跨配置
 * 校验器（规则 9）校验 valueMap 的每个值。
 */
export interface PixelSizeConstraints {
  /** 最长边像素上限（某些上游无此约束 → 不声明） */
  maxEdge?: number;
  /** 两边都必须是它的整数倍（某些上游无此约束 → 不声明） */
  edgeMultipleOf?: number;
  /** 长边 / 短边 比例上限 */
  maxRatio: number;
  /** 总像素下限（含） */
  minPixels: number;
  /** 总像素上限（含） */
  maxPixels: number;
}

/** Binding specification for a preset parameter */
export interface BindingSpec {
  path: string; // 'size' | 'generationConfig.seed' | '$url.model'
  /**
   * 该绑定的取值由**多个**统一参数拼成，而不是绑定名对应的那一个。
   * 拼出来的 key 再过 `valueMap`（二元/多元查表）。
   *
   * 存在的理由：gpt-image 收的是像素尺寸 `WxH`，而前端只选「比例」和「档位」——
   * `size` 不对应任何单个统一参数，它是 (aspectRatio, resolution) 的函数。一元
   * valueMap 表达不了这个。绑定名（这里是 `size`）因此**不必是 schema 里的属性**，
   * 但 `composeFrom` 里的每一个**必须是**（跨配置校验器规则 1b 据此放行）。
   */
  composeFrom?: string[];
  /** `composeFrom` 拼 key 的分隔符，默认 `@` */
  join?: string;
  valueMap?: Record<string, string>;
  transform?: TransformKey;
  omitWhen?: 'empty';
  /**
   * 该复合绑定产出的是像素尺寸串（`WxH`）。声明后，跨配置校验器（规则 9）会校验
   * `valueMap` 的**每个值**都满足这些上游约束——把「表里写了上游会 400 的尺寸」这类
   * 错误从运行期的偶发 400 提前到保存期的红灯。
   */
  pixelSizeConstraints?: PixelSizeConstraints;
}

/** How a plain param binds into the request: either a path write, or a strategy */
export type ParamStrategy =
  | { strategy: 'prompt-inject'; template: string } // '{{value}}' 占位
  | { strategy: 'ignore' };

/** How the requested image count binds into the request */
export type CountBinding = BindingSpec | { strategy: 'fan-out'; maxConcurrency: number };

/** HTTP endpoint for an operation */
export interface EndpointSpec {
  method: 'POST';
  path: string;
}

/** Multipart upload shape */
export interface MultipartSpec {
  imageField: string;
  indexBase: 0 | 1;
  filenamePattern: string;
  maskField?: string;
}

/** How to read images and metadata out of the upstream response */
export interface ResponseSpec {
  itemsPath: string; // 'data[*]' | 'candidates[*].content.parts[*]'
  b64Field?: string;
  urlField?: string;
  mimeField?: string;
  defaultMime: string;
  seedField?: string;
  revisedPromptField?: string;
}

/** 声明一个 preset 的参考图/图生图机制（各厂商官方原生格式）。 */
export type ReferenceMode =
  | { kind: 'edit-multipart' }
  | { kind: 'generate-inline-base64'; partsPath: string }
  | {
      kind: 'generate-json-url';
      /** 图 URL 写进 generate body 的 JSON path（如 'image'）。 */
      path: string;
      /** 'scalar-or-array'：恰好 1 张写标量、多张写数组；'array'：恒数组。 */
      container: 'scalar-or-array' | 'array';
      /** 'url-string'：数组元素是裸 URL 字符串；对象模板：{...objectTemplate, [urlField]: url}。 */
      item: 'url-string' | { objectTemplate: Record<string, unknown>; urlField: string };
      /** 上游能收的最多参考图张数；超出在 assemble 截断。 */
      maxImages?: number;
    };

/** Protocol preset for an adapter */
export interface ProtocolPreset {
  key: string;
  transport: Transport;
  timeoutMs: number;
  auth: { in: 'header' | 'query'; name: string; template: string }; // 'Bearer {apiKey}'
  endpoints: Partial<Record<ImageOperation, EndpointSpec>>;
  coreBindings: Partial<
    Record<
      ImageOperation,
      {
        model: BindingSpec;
        prompt: BindingSpec;
        count: CountBinding;
        inputImages?: BindingSpec;
      }
    >
  >;
  paramBindings: Record<string, BindingSpec | BindingSpec[] | ParamStrategy>;
  staticBody?: Record<string, unknown>;
  multipart?: MultipartSpec;
  /**
   * 该 preset 的参考图机制（取代旧 inlineImageEmbed）：
   * - edit-multipart：图走 multipart 表单 + edit 端点（OpenAI /v1/images/edits）；由路由把 operation 切到 edit。
   * - generate-inline-base64：图 base64 内联进 JSON body 的 partsPath 数组（Gemini generateContent）。
   * - generate-json-url：图 URL 写进 generate body 的 path（火山 Seedream 的 image 字段）。
   */
  referenceMode?: ReferenceMode;
  response: ResponseSpec;
  errorMapping: Record<string, ErrorClassification>; // '400' | '*'
}

/** Image generation/edit request */
export interface ImageCallRequest {
  preset: ProtocolPreset;
  operation: ImageOperation;
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  count: number;
  /** 已经过 role 投影的 wire 子集。引擎不认识 role。 */
  params: Record<string, unknown>;
  sourceImages?: Array<{ url: string }>;
  referenceImages?: Array<{ url: string }>;
  maskUrl?: string;
}

/** Generated or edited image artifact */
export interface ImageArtifact {
  source:
    | { type: 'base64'; data: string; mimeType: string }
    | { type: 'url'; url: string; mimeType?: string };
  index: number;
  seed?: string;
  revisedPrompt?: string;
}

/** Image generation/edit result */
export interface ImageCallResult {
  artifacts: ImageArtifact[];
  applied: { params: Record<string, unknown>; coercions: string[] };
  upstream: {
    protocolKey: string;
    endpoint: string;
    httpStatus: number;
    requestId?: string;
    durationMs: number;
  };
  warnings: string[];
}

/**
 * 上游调用失败。分类由 preset 的 `errorMapping` 声明 —— 取代「从错误消息里正则
 * 反推 HTTP 状态码」的老做法（spec §4.6）。
 *
 * `message` 只放英文诊断串（进日志）。**不写死中文文案**（spec §8）：面向用户的
 * 文案由 api-service 的 i18n 决定。`upstreamBody` 是截断后的上游原文，进日志不进 UI。
 */
export class ImageUpstreamError extends Error {
  readonly classification: ErrorClassification;
  readonly httpStatus?: number;
  readonly retryable: boolean;
  readonly upstreamBody?: string;
  /** 实际打到的上游端点（含 host + path）——链路排障时定位「打的是哪个域名/路径」。 */
  readonly endpoint?: string;
  /** 上游回传的请求追踪 id（`x-request-id`），便于和上游侧日志对账。 */
  readonly requestId?: string;
  /** 上游回传的 `retry-after`（秒/日期原文），503/429 时判断退避窗口。 */
  readonly retryAfter?: string;

  constructor(init: {
    message: string;
    classification: ErrorClassification;
    httpStatus?: number;
    retryable: boolean;
    upstreamBody?: string;
    endpoint?: string;
    requestId?: string;
    retryAfter?: string;
  }) {
    super(init.message);
    this.name = 'ImageUpstreamError';
    this.classification = init.classification;
    this.httpStatus = init.httpStatus;
    this.retryable = init.retryable;
    this.upstreamBody = init.upstreamBody;
    this.endpoint = init.endpoint;
    this.requestId = init.requestId;
    this.retryAfter = init.retryAfter;
  }
}
