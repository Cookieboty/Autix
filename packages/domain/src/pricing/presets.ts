import type { ParamsSchema, PricingSchema } from './types';

export type ModelPresetKey = 'text' | 'image' | 'video';

export interface ModelPreset {
  paramsSchema: ParamsSchema;
  pricingSchema: PricingSchema;
}

const JSON_SCHEMA_DRAFT = 'https://json-schema.org/draft/2020-12/schema';

/**
 * token 参数由后端注入，用户不可见（hidden）。它们的值在结算时才确定
 * （valueSource: 'usage'）——不下单时冻结、不填默认值，由 quoteTask 把
 * settlement 的真实 usage 合并进模型侧求值。见 spec §3.1.1.65。
 *
 * `default: 0` 仍然声明在这里是给 ajv 校验用的形状占位（属性存在时的取值
 * 范围），但 applyParamDefaults 会因 valueSource === 'usage' 而跳过它，
 * 绝不会把它填进 params 再冻进快照。
 */
const tokenProperties = {
  inputTokens: { type: 'integer' as const, minimum: 0, default: 0, 'x-ui': { control: 'hidden' as const, valueSource: 'usage' as const } },
  outputTokens: { type: 'integer' as const, minimum: 0, default: 0, 'x-ui': { control: 'hidden' as const, valueSource: 'usage' as const } },
};

/**
 * 唯一的 text 模型 preset（原 chat_fast / chat_standard / chat_reasoning 三档合并）。
 *
 * 旧的三档靠 metadata.tier 选择，线上 13 个模型没有一个设置过这个字段，
 * 分档在事实上从未生效——见 spec §3.1.1.6。现在所有 text 模型统一走纯 token
 * 计价，没有每条消息的基础费；任务之间的差异化改由 TaskPreset.fixedCostSchema
 * 承担（同一模型跑不同任务时固定费不同，token 单价相同）。
 */
const textPreset: ModelPreset = {
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
      // base: 0 不是可省略的装饰——validatePricingSchema 要求首项是无 when 的
      // const add，因为累加器从 0 起步，mul 作用在 0 上恒为 0；table/perUnit
      // 首项还可能因查表未命中/参数缺失被跳过。const 0 是唯一总能兜住的首项。
      { id: 'base', op: 'add', const: 0 },
      // 费率 1 / 5 沿用旧 chat_standard 档，只是个占位继承值。
      // 各模型单独配费率是后续工作——gpt-5.5 不该和 kimi 同价。
      { id: 'inputTokens', op: 'add', perUnit: { param: 'inputTokens', unitCost: 1, divisor: 1000 } },
      { id: 'outputTokens', op: 'add', perUnit: { param: 'outputTokens', unitCost: 5, divisor: 1000 } },
    ],
  },
};

const imagePreset: ModelPreset = {
  paramsSchema: {
    $schema: JSON_SCHEMA_DRAFT,
    type: 'object',
    required: ['quality', 'resolution'],
    properties: {
      quality: { type: 'string', enum: ['low', 'medium', 'high'], default: 'medium', 'x-ui': { control: 'chips', labelKey: 'pricing.params.quality', optionLabelKeys: { low: 'pricing.options.low', medium: 'pricing.options.medium', high: 'pricing.options.high' }, order: 10 } },
      resolution: { type: 'string', enum: ['512px', '1K', '2K', '4K'], default: '1K', 'x-ui': { control: 'chips', labelKey: 'pricing.params.resolution', order: 20 } },
      // 生成张数(quantity)不再是图像计价参数——张数由业务逻辑在下单时按张乘算，
      // 这套 preset 只描述「一张」的参数与价格。
      referenceImages: { type: 'integer', minimum: 0, maximum: 4, default: 0, 'x-ui': { control: 'hidden' } },
    },
  },
  pricingSchema: {
    terms: [
      { id: 'base', op: 'add', const: 1 },
      { id: 'quality', op: 'mul', table: { param: 'quality', values: { low: 15, medium: 90, high: 350 } } },
      { id: 'resolution', op: 'mul', table: { param: 'resolution', values: { '512px': 0.5, '1K': 1, '2K': 2, '4K': 4 } } },
      // 无 quantity 项：单张价格；张数由业务逻辑吃掉（见 paramsSchema 注释）。
      { id: 'referenceImages', op: 'add', perUnit: { param: 'referenceImages', unitCost: 5 } },
    ],
  },
};

const videoPreset: ModelPreset = {
  paramsSchema: {
    $schema: JSON_SCHEMA_DRAFT,
    type: 'object',
    required: ['resolution', 'duration'],
    properties: {
      resolution: { type: 'string', enum: ['480p', '720p', '1080p', '4k'], default: '720p', 'x-ui': { control: 'chips', labelKey: 'pricing.params.resolution', order: 10 } },
      duration: { type: 'integer', minimum: 4, maximum: 15, default: 5, 'x-ui': { control: 'stepper', labelKey: 'pricing.params.duration', order: 20 } },
      ratio: { type: 'string', enum: ['1:1', '16:9', '9:16'], default: '16:9', 'x-ui': { control: 'chips', labelKey: 'pricing.params.ratio', order: 30 } },
    },
    allOf: [
      {
        if: { properties: { resolution: { const: '4k' } } },
        // then 分支重声明 type，否则 ajv strictTypes 拒绝编译（见 Task 9）
        then: { properties: { duration: { type: 'integer', maximum: 8 } } },
      },
    ],
  },
  pricingSchema: {
    terms: [
      { id: 'base', op: 'add', const: 1 },
      { id: 'resolution', op: 'mul', table: { param: 'resolution', values: { '480p': 160, '720p': 320, '1080p': 800, '4k': 1600 } } },
      { id: 'duration', op: 'mul', perUnit: { param: 'duration', unitCost: 1 } },
    ],
  },
};

export const MODEL_PRESETS: Record<ModelPresetKey, ModelPreset> = {
  text: textPreset,
  image: imagePreset,
  video: videoPreset,
};

export type TaskCategory = 'chat' | 'image' | 'video' | 'prompt';

export interface TaskPreset {
  taskType: string;
  name: string;
  category: TaskCategory;
  /**
   * 任务侧固定开销。求值输入是 usage（toolCalls / mcpCalls / ...），不是模型参数。
   * 数值取自旧 seed（services/api/scripts/ensure-pricing-rules.ts）的 base 组件。
   *
   * null 与「schema 里一个 const 0 的 term」在 quoteTask() 眼里等价——taskFixedSchema
   * 缺省时按 total: 0 处理。这里选择用 null 表示「该任务在旧规则里根本没有 base
   * 组件」（image_generation / video_generation），而不是编一个恒为 0 的 term
   * 假装存在过这样一笔费用；有非零固定费的任务一律显式给 schema，哪怕将来某个
   * 新任务的固定费恰好也是 0，也应该给它一个 const 0 的 schema 而非 null——
   * 那样 breakdown 里才看得见「这个任务确实评估过固定费，只是当前是 0」。
   * 但现有 9 个任务里唯二的 0 都对应「旧规则从未有 base 组件」，所以两者都用 null。
   */
  fixedCostSchema: PricingSchema | null;
  /** 该任务当前是否可用。无可用模型可绑的任务必须置 false（spec §3.1.1.7）。 */
  isActive: boolean;
  /** 该任务默认绑定哪些模型 preset。seed 据此建 task_model_bindings。 */
  modelPresets: ModelPresetKey[];
}

/** 任务侧固定费 schema 的唯一形状：一个无条件的 const add 项。 */
function fixedFee(amount: number): PricingSchema {
  return { terms: [{ id: 'taskBase', op: 'add', const: amount }] };
}

export const TASK_PRESETS: TaskPreset[] = [
  { taskType: 'chat_message_fast', name: 'Fast chat', category: 'chat', fixedCostSchema: fixedFee(1), isActive: false, modelPresets: ['text'] },
  { taskType: 'chat_message_standard', name: 'Standard chat', category: 'chat', fixedCostSchema: fixedFee(3), isActive: true, modelPresets: ['text'] },
  { taskType: 'chat_message_reasoning', name: 'Deep reasoning chat', category: 'chat', fixedCostSchema: fixedFee(10), isActive: false, modelPresets: ['text'] },
  { taskType: 'image_generation', name: 'Image generation', category: 'image', fixedCostSchema: null, isActive: true, modelPresets: ['image'] },
  { taskType: 'video_generation', name: 'Video generation', category: 'video', fixedCostSchema: null, isActive: true, modelPresets: ['video'] },
  { taskType: 'prompt_optimize_generation', name: 'Image workbench prompt optimization', category: 'prompt', fixedCostSchema: fixedFee(1), isActive: true, modelPresets: ['text'] },
  { taskType: 'video_template_optimize', name: 'Video template prompt optimization', category: 'prompt', fixedCostSchema: fixedFee(1), isActive: true, modelPresets: ['text'] },
  { taskType: 'video_storyboard_optimize', name: 'Video storyboard optimization', category: 'prompt', fixedCostSchema: fixedFee(1), isActive: true, modelPresets: ['text'] },
  { taskType: 'prompt_optimize_pro', name: 'Artifact document AI optimization', category: 'prompt', fixedCostSchema: fixedFee(1), isActive: true, modelPresets: ['text'] },
];
