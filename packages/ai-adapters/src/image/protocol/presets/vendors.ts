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
  paramBindings: {
    aspectRatio: { path: 'aspect_ratio' },
    resolution: { path: 'image_size' },
    thinkingLevel: { path: 'thinking_level' },
  },
};

/**
 * MiniMax —— 没有分辨率档位；额外两个开关。
 */
export const minimaxImagesV1: ProtocolPreset = {
  ...COMMON,
  key: 'minimax-images@v1',
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
  staticBody: { response_format: 'b64_json' },
  paramBindings: {
    size: { path: 'size', composeFrom: ['aspectRatio', 'resolution'], join: '@', valueMap: GPT_IMAGE_SIZE },
    quality: { path: 'quality' },
    background: { path: 'background' },
    outputFormat: { path: 'output_format' },
  },
};

export { GPT_IMAGE_SIZE };
