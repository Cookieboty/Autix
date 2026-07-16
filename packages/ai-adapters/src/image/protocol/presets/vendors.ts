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
 * 火山 Seedream —— 统一参数与原生字段同名，直接落。
 */
export const doubaoImagesV1: ProtocolPreset = {
  ...COMMON,
  key: 'doubao-images@v1',
  referenceMode: { kind: 'generate-json-url', path: 'image', container: 'scalar-or-array', item: 'url-string', maxImages: 14 },
  paramBindings: {
    aspectRatio: { path: 'aspect_ratio' },
    resolution: { path: 'resolution' },
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
  '1:1@4K': '4096x4096',
  '3:2@1K': '1536x1024',
  '3:2@2K': '2048x1365',
  '3:2@4K': '3840x2560',
  '2:3@1K': '1024x1536',
  '2:3@2K': '1365x2048',
  '2:3@4K': '2560x3840',
  '16:9@1K': '1536x864',
  '16:9@2K': '2048x1152',
  '16:9@4K': '3840x2160',
  '9:16@1K': '864x1536',
  '9:16@2K': '1152x2048',
  '9:16@4K': '2160x3840',
};

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
    size: { path: 'size', composeFrom: ['aspectRatio', 'resolution'], join: '@', valueMap: GPT_IMAGE_SIZE },
    quality: { path: 'quality' },
    background: { path: 'background' },
    outputFormat: { path: 'output_format' },
  },
};

export { GPT_IMAGE_SIZE };
