import type { ParamsSchema, PricingSchema } from './types';

export type ModelPresetKey = 'chat_fast' | 'chat_standard' | 'chat_reasoning' | 'image' | 'video';

export interface ModelPreset {
  paramsSchema: ParamsSchema;
  pricingSchema: PricingSchema;
}

const JSON_SCHEMA_DRAFT = 'https://json-schema.org/draft/2020-12/schema';

/** token 参数由后端在估价/结算时注入，用户不可见。 */
const tokenProperties = {
  inputTokens: { type: 'integer' as const, minimum: 0, default: 0, 'x-ui': { control: 'hidden' as const } },
  outputTokens: { type: 'integer' as const, minimum: 0, default: 0, 'x-ui': { control: 'hidden' as const } },
};

function chatPreset(base: number, inputPerK: number, outputPerK: number): ModelPreset {
  return {
    paramsSchema: {
      $schema: JSON_SCHEMA_DRAFT,
      type: 'object',
      properties: {
        temperature: { type: 'number', minimum: 0, maximum: 2, default: 0.7, 'x-ui': { control: 'slider', labelKey: 'pricing.params.temperature', order: 10, step: 0.1 } },
        maxTokens: { type: 'integer', minimum: 1, maximum: 128000, default: 4096, 'x-ui': { control: 'stepper', labelKey: 'pricing.params.maxTokens', order: 20 } },
        ...tokenProperties,
      },
    },
    pricingSchema: {
      terms: [
        { id: 'base', op: 'add', const: base },
        { id: 'inputTokens', op: 'add', perUnit: { param: 'inputTokens', unitCost: inputPerK, divisor: 1000 } },
        { id: 'outputTokens', op: 'add', perUnit: { param: 'outputTokens', unitCost: outputPerK, divisor: 1000 } },
      ],
    },
  };
}

const chatReasoning: ModelPreset = (() => {
  const preset = chatPreset(10, 3, 15);
  return {
    paramsSchema: {
      ...preset.paramsSchema,
      properties: {
        ...preset.paramsSchema.properties,
        reasoning: { type: 'boolean', default: true, 'x-ui': { control: 'switch', labelKey: 'pricing.params.reasoning', order: 30 } },
      },
    },
    pricingSchema: {
      terms: [
        ...preset.pricingSchema.terms,
        { id: 'reasoning', op: 'mul', const: 1.2, when: { all: [{ param: 'reasoning', op: 'eq', value: true }] } },
      ],
    },
  };
})();

const imagePreset: ModelPreset = {
  paramsSchema: {
    $schema: JSON_SCHEMA_DRAFT,
    type: 'object',
    required: ['quality', 'resolution'],
    properties: {
      quality: { type: 'string', enum: ['low', 'medium', 'high'], default: 'medium', 'x-ui': { control: 'chips', labelKey: 'pricing.params.quality', order: 10 } },
      resolution: { type: 'string', enum: ['512px', '1K', '2K', '4K'], default: '1K', 'x-ui': { control: 'chips', labelKey: 'pricing.params.resolution', order: 20 } },
      quantity: { type: 'integer', minimum: 1, maximum: 4, default: 1, 'x-ui': { control: 'stepper', labelKey: 'pricing.params.quantity', order: 30 } },
      referenceImages: { type: 'integer', minimum: 0, maximum: 4, default: 0, 'x-ui': { control: 'hidden' } },
    },
  },
  pricingSchema: {
    terms: [
      { id: 'base', op: 'add', const: 1 },
      { id: 'quality', op: 'mul', table: { param: 'quality', values: { low: 15, medium: 90, high: 350 } } },
      { id: 'resolution', op: 'mul', table: { param: 'resolution', values: { '512px': 0.5, '1K': 1, '2K': 2, '4K': 4 } } },
      { id: 'quantity', op: 'mul', perUnit: { param: 'quantity', unitCost: 1 } },
      { id: 'referenceImages', op: 'add', perUnit: { param: 'referenceImages', unitCost: 5 } },
    ],
  },
};

const videoPreset: ModelPreset = {
  paramsSchema: {
    $schema: JSON_SCHEMA_DRAFT,
    type: 'object',
    required: ['resolution', 'seconds'],
    properties: {
      resolution: { type: 'string', enum: ['480p', '720p', '1080p', '4k'], default: '720p', 'x-ui': { control: 'chips', labelKey: 'pricing.params.resolution', order: 10 } },
      seconds: { type: 'integer', minimum: 4, maximum: 15, default: 5, 'x-ui': { control: 'stepper', labelKey: 'pricing.params.duration', order: 20 } },
      ratio: { type: 'string', enum: ['1:1', '16:9', '9:16'], default: '16:9', 'x-ui': { control: 'chips', labelKey: 'pricing.params.ratio', order: 30 } },
    },
    allOf: [
      {
        if: { properties: { resolution: { const: '4k' } } },
        // then 分支重声明 type，否则 ajv strictTypes 拒绝编译（见 Task 9）
        then: { properties: { seconds: { type: 'integer', maximum: 8 } } },
      },
    ],
  },
  pricingSchema: {
    terms: [
      { id: 'base', op: 'add', const: 1 },
      { id: 'resolution', op: 'mul', table: { param: 'resolution', values: { '480p': 160, '720p': 320, '1080p': 800, '4k': 1600 } } },
      { id: 'seconds', op: 'mul', perUnit: { param: 'seconds', unitCost: 1 } },
    ],
  },
};

export const MODEL_PRESETS: Record<ModelPresetKey, ModelPreset> = {
  chat_fast: chatPreset(1, 0.5, 2),
  chat_standard: chatPreset(3, 1, 5),
  chat_reasoning: chatReasoning,
  image: imagePreset,
  video: videoPreset,
};

export type TaskCategory = 'chat' | 'image' | 'video' | 'prompt';

export interface TaskPreset {
  taskType: string;
  name: string;
  category: TaskCategory;
  /** 任务侧固定开销。求值输入是 usage（toolCalls / mcpCalls / ...），不是模型参数。 */
  fixedCostSchema: PricingSchema | null;
  /** 该任务默认绑定哪些模型 preset。seed 据此建 task_model_bindings。 */
  modelPresets: ModelPresetKey[];
}

export const TASK_PRESETS: TaskPreset[] = [
  { taskType: 'chat_message_fast', name: '快速对话', category: 'chat', fixedCostSchema: null, modelPresets: ['chat_fast'] },
  { taskType: 'chat_message_standard', name: '普通对话', category: 'chat', fixedCostSchema: null, modelPresets: ['chat_standard'] },
  { taskType: 'chat_message_reasoning', name: '深度思考对话', category: 'chat', fixedCostSchema: null, modelPresets: ['chat_reasoning'] },
  { taskType: 'image_generation', name: '图片生成', category: 'image', fixedCostSchema: null, modelPresets: ['image'] },
  { taskType: 'video_generation', name: '视频生成', category: 'video', fixedCostSchema: null, modelPresets: ['video'] },
  { taskType: 'prompt_optimize_generation', name: '图片工作台 Prompt 优化', category: 'prompt', fixedCostSchema: null, modelPresets: ['chat_fast'] },
  { taskType: 'video_template_optimize', name: '视频模板 Prompt 优化', category: 'prompt', fixedCostSchema: null, modelPresets: ['chat_fast'] },
  { taskType: 'video_storyboard_optimize', name: '视频分镜优化', category: 'prompt', fixedCostSchema: null, modelPresets: ['chat_fast'] },
  { taskType: 'prompt_optimize_pro', name: 'Artifact 文档 AI 优化', category: 'prompt', fixedCostSchema: null, modelPresets: ['chat_fast'] },
];
