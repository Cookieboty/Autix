import type { ProtocolPreset } from '../types';

/**
 * 当前所有图片模型走的协议（spec §7.3）。名字里不含任何网关品牌 —— 它描述的是
 * 「OpenAI images 兼容协议 v1」这套线上形状，不是某一个运行环境（口径 5）。
 *
 * 三个手写 adapter 的差异到这里全部变成声明：
 *   - size 的 @tier 后缀 → transform: 'stripTierSuffix'（无损，spec §7.3）
 *   - n / response_format → coreBindings.count + staticBody
 *   - multipart 字段名与 index base → multipart spec
 */
export const gatewayOpenAIV1: ProtocolPreset = {
  key: 'openai-images@v1',
  transport: 'sync-json',
  timeoutMs: 600_000,
  auth: { in: 'header', name: 'Authorization', template: 'Bearer {apiKey}' },

  endpoints: {
    generate: { method: 'POST', path: '/v1/images/generations' },
    edit: { method: 'POST', path: '/v1/images/edits' },
  },

  coreBindings: {
    generate: {
      model: { path: 'model' },
      prompt: { path: 'prompt' },
      count: { path: 'n' },
    },
    edit: {
      model: { path: 'model' },
      prompt: { path: 'prompt' },
      count: { path: 'n' },
      inputImages: { path: 'image' },
    },
  },

  paramBindings: {
    size: { path: 'size', transform: 'stripTierSuffix' },
    quality: { path: 'quality', omitWhen: 'empty' },
    seed: { path: 'seed', omitWhen: 'empty' },
    negativePrompt: { strategy: 'prompt-inject', template: 'avoid: {{value}}' },
  },

  staticBody: { response_format: 'b64_json' },

  multipart: { imageField: 'image', indexBase: 1, filenamePattern: 'source-{i}', maskField: 'mask' },

  response: {
    itemsPath: 'data[*]',
    b64Field: 'b64_json',
    urlField: 'url',
    revisedPromptField: 'revised_prompt',
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
};
