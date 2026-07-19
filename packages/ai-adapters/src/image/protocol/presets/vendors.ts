import type { ProtocolPreset } from '../types';

/**
 * 逐厂商的 protocol preset —— 把**统一参数**翻译成**上游原生字段**。
 *
 * 前端与 paramsSchema 只认识统一词汇（`aspectRatio` / `resolution` / `quality` / …）；
 * `aspect_ratio` / `image_size` / `size` 这些厂商字段名**只出现在这里的绑定表里**。
 *
 * 四个 preset 共用同一套传输形态（同一个 OpenAI 兼容端点、Bearer 鉴权、`data[]` 响应）——
 * 差异全在 body 字段上。baseUrl / apiKey 是**逐模型配置**（口径 5：preset 里没有默认域名，
 * 也不读 env）。
 */

const COMMON = {
  transport: 'sync-json',
  timeoutMs: 600_000,
  auth: { in: 'header', name: 'Authorization', template: 'Bearer {apiKey}' },
  endpoints: {
    generate: { method: 'POST', path: '/v1/images/generations' },
    edit: { method: 'POST', path: '/v1/images/edits' },
  },
  coreBindings: {
    generate: { model: { path: 'model' }, prompt: { path: 'prompt' }, count: { path: 'n' } },
    edit: {
      model: { path: 'model' },
      prompt: { path: 'prompt' },
      count: { path: 'n' },
      inputImages: { path: 'image' },
    },
  },
  multipart: { imageField: 'image', indexBase: 1, filenamePattern: 'source-{i}', maskField: 'mask' },
  response: {
    itemsPath: 'data[*]',
    b64Field: 'b64_json',
    urlField: 'url',
    defaultMime: 'image/png',
  },
  errorMapping: {
    '400': 'params',
    '401': 'auth',
    '403': 'auth',
    '422': 'params',
    '429': 'rate-limit',
    '451': 'content-policy',
    '*': 'upstream',
  },
} satisfies Omit<ProtocolPreset, 'key' | 'paramBindings'>;

/**
 * 火山 Seedream 的 `size` —— 和 gpt-image 一样是 (比例 × 档位) 查表得像素串。
 *
 * Ark `/images/generations` 只收**单个** `size` 字段（可为档位 `2K` 或像素 `WxH`，不可混用），
 * 没有独立的 `aspect_ratio` / `resolution` 字段。要让输出同时尊重用户选的**比例**和计价用的
 * **档位**，唯一的形态是发 `WxH`——按官方文档「方式 1」的 (档位 × 比例) → 像素参考表拼出。
 *
 * 4.5（2K/4K）与 5.0-lite（2K/3K/4K）的同档位映射值一致，故合成一张覆盖 2K/3K/4K × 8 比例。
 * 每个模型的 schema 只选自己支持的档位，规则 8 逐模型校验组合覆盖。
 */
const SEEDREAM_SIZE: Record<string, string> = {
  '1:1@2K': '2048x2048', '4:3@2K': '2304x1728', '3:4@2K': '1728x2304', '16:9@2K': '2848x1600',
  '9:16@2K': '1600x2848', '3:2@2K': '2496x1664', '2:3@2K': '1664x2496', '21:9@2K': '3136x1344',
  '1:1@3K': '3072x3072', '4:3@3K': '3456x2592', '3:4@3K': '2592x3456', '16:9@3K': '4096x2304',
  '9:16@3K': '2304x4096', '3:2@3K': '3744x2496', '2:3@3K': '2496x3744', '21:9@3K': '4704x2016',
  '1:1@4K': '4096x4096', '4:3@4K': '4704x3520', '3:4@4K': '3520x4704', '16:9@4K': '5504x3040',
  '9:16@4K': '3040x5504', '3:2@4K': '4992x3328', '2:3@4K': '3328x4992', '21:9@4K': '6240x2656',
};

/**
 * Seedream `size`（方式 2）的硬性约束：总像素 ∈ [3.68M, 16.77M]、长短边 ∈ [1/16, 16]。
 * 和 gpt-image **不同**：没有 16 倍数、也没有最长边上限——故 maxEdge/edgeMultipleOf 不声明。
 */
const SEEDREAM_SIZE_CONSTRAINTS = {
  maxRatio: 16,
  minPixels: 3_686_400,
  maxPixels: 16_777_216,
} as const;

/**
 * 火山 Seedream 4.5 / 5.0-lite —— `size` 是 (比例 × 档位) 复合，不是同名直落。
 */
export const doubaoImagesV1: ProtocolPreset = {
  ...COMMON,
  key: 'doubao-images@v1',
  referenceMode: { kind: 'generate-json-url', path: 'image', container: 'scalar-or-array', item: 'url-string', maxImages: 14 },
  paramBindings: {
    size: {
      path: 'size', composeFrom: ['aspectRatio', 'resolution'], join: '@',
      valueMap: SEEDREAM_SIZE, pixelSizeConstraints: SEEDREAM_SIZE_CONSTRAINTS,
    },
    safetyChecker: { path: 'enable_safety_checker' },
  },
};

/**
 * Gemini —— 档位换个字段名叫 `image_size`。
 */
export const geminiImagesV1: ProtocolPreset = {
  ...COMMON,
  key: 'gemini-images@v1',
  referenceMode: { kind: 'edit-multipart' },
  paramBindings: {
    aspectRatio: { path: 'aspect_ratio' },
    resolution: { path: 'image_size' },
    thinkingLevel: { path: 'thinking_level' },
  },
};

/**
 * Gemini 原生 `generateContent` —— 与上面的 OpenAI 兼容 shim（`gemini-images@v1`）不同，
 * 这是 Google 原生形态：model 进 URL、prompt/图片进 `contents[].parts[]`、`responseModalities`
 * 声明出图、响应从 `candidates[*].content.parts[*].inlineData` 读。经网关原生透传时
 * `baseUrl` 不应带 OpenAI 的 `/v1` 后缀（否则会拼成 `/v1/v1beta/...`）。
 *
 * - 鉴权：原生用 `x-goog-api-key`。若某网关的透传要 `Authorization: Bearer`，改这一行即可。
 * - 张数：generateContent 单次产 1 张 → 走 fan-out，不发 `n`。
 * - 图生图：输入图片以 base64 内联进 parts（见 `inlineImageEmbed` + execute 的 embedInlineImages）。
 */
export const geminiGenerateContentV1: ProtocolPreset = {
  key: 'gemini-generate-content@v1',
  transport: 'sync-json',
  timeoutMs: COMMON.timeoutMs,
  auth: { in: 'header', name: 'x-goog-api-key', template: '{apiKey}' },
  endpoints: {
    generate: { method: 'POST', path: '/v1beta/models/{model}:generateContent' },
    edit: { method: 'POST', path: '/v1beta/models/{model}:generateContent' },
  },
  coreBindings: {
    generate: {
      model: { path: '$url.model' },
      prompt: { path: 'contents[0].parts[0].text' },
      count: { strategy: 'fan-out', maxConcurrency: 4 },
    },
    edit: {
      model: { path: '$url.model' },
      prompt: { path: 'contents[0].parts[0].text' },
      count: { strategy: 'fan-out', maxConcurrency: 4 },
      inputImages: { path: 'contents[0].parts' },
    },
  },
  paramBindings: {
    aspectRatio: { path: 'generationConfig.imageConfig.aspectRatio' },
    resolution: { path: 'generationConfig.imageConfig.imageSize', omitWhen: 'empty' },
    thinkingLevel: { path: 'generationConfig.thinkingConfig.thinkingLevel', omitWhen: 'empty' },
  },
  staticBody: { generationConfig: { responseModalities: ['IMAGE'] } },
  referenceMode: { kind: 'generate-inline-base64', partsPath: 'contents[0].parts' },
  response: {
    itemsPath: 'candidates[*].content.parts[*]',
    b64Field: 'inlineData.data',
    mimeField: 'inlineData.mimeType',
    defaultMime: 'image/png',
  },
  errorMapping: COMMON.errorMapping,
};

/**
 * MiniMax —— 没有分辨率档位；额外两个开关。
 */
export const minimaxImagesV1: ProtocolPreset = {
  ...COMMON,
  key: 'minimax-images@v1',
  // 不声明 referenceMode：MiniMax 已从 DB/seed 移除、无模型使用；其原生参考图是 generate 侧
  // subject_reference（非 edit-multipart），将来若重新接入需按原生格式新增 preset，此处不预声明错的机制。
  paramBindings: {
    aspectRatio: { path: 'aspect_ratio' },
    promptOptimizer: { path: 'prompt_optimizer' },
    watermark: { path: 'watermark' },
  },
};

/**
 * (比例 × 档位) → 像素尺寸。**这是 gpt-image 与其它三家唯一的结构性差异**：
 * 它收的是 `WxH`，不是比例。用户仍然只选比例和档位，像素由这张表查出来。
 *
 * 查表的 key 由**两个**统一参数拼成（`composeFrom` + `join`），因为一元 valueMap
 * 表达不了二元查表。
 */
const GPT_IMAGE_SIZE: Record<string, string> = {
  '1:1@1K': '1024x1024',
  '1:1@2K': '2048x2048',
  // 4K 正方形不存在：像素上限 8,294,400 ⇒ 正方形最大边 = √8294400 = 2880（2880 恰是 16 的倍数）。
  '1:1@4K': '2880x2880',
  '3:2@1K': '1536x1024',
  // 2K/4K 的 3:2、2:3 边长必须是 16 的倍数，且 4K 档要压在像素上限内（3840x2560=9.83M 超限）。
  '3:2@2K': '2016x1344',
  '3:2@4K': '3504x2336',
  '2:3@1K': '1024x1536',
  '2:3@2K': '1344x2016',
  '2:3@4K': '2336x3504',
  '16:9@1K': '1536x864',
  '16:9@2K': '2048x1152',
  '16:9@4K': '3840x2160',
  '9:16@1K': '864x1536',
  '9:16@2K': '1152x2048',
  '9:16@4K': '2160x3840',
};

/**
 * gpt-image-2 端点对 `size` 的硬性约束（上游契约，不通用于别家）。声明在 size 绑定上，
 * 由跨配置校验器（规则 9）对 GPT_IMAGE_SIZE 的**每个值**逐条校验——防止再往表里写进
 * 上游会 400 的尺寸（超边 / 非 16 倍数 / 超像素上限），在运行期变成偶发 400。
 */
const GPT_IMAGE_SIZE_CONSTRAINTS = {
  maxEdge: 3840,
  edgeMultipleOf: 16,
  maxRatio: 3,
  minPixels: 655_360,
  maxPixels: 8_294_400,
} as const;

/**
 * OpenAI GPT Image —— 唯一收像素尺寸的一家。
 * `size` 不来自任何单个统一参数，而是 (aspectRatio, resolution) 拼 key 后查表。
 */
export const openaiImagesV1: ProtocolPreset = {
  ...COMMON,
  key: 'openai-images@v1',
  // 不发 response_format：gpt-image 系列（gpt-image-1/2）**不接受**这个参数（恒返回
  // b64_json），且 /v1/images/edits 端点会以 `Unknown parameter: 'response_format'` 400 掉
  // （dall-e 才用 response_format）。响应侧同时认 b64_json 与 url（见 COMMON.response），
  // 去掉它对 generate/edit 两条路径都安全。
  referenceMode: { kind: 'edit-multipart' },
  paramBindings: {
    size: {
      path: 'size', composeFrom: ['aspectRatio', 'resolution'], join: '@',
      valueMap: GPT_IMAGE_SIZE, pixelSizeConstraints: GPT_IMAGE_SIZE_CONSTRAINTS,
    },
    quality: { path: 'quality' },
    background: { path: 'background' },
    outputFormat: { path: 'output_format' },
  },
};

export { GPT_IMAGE_SIZE };
