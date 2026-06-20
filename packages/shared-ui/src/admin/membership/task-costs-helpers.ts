import type { GenerationPricingRule } from '@autix/shared-store';

export type RuleField =
  | 'baseCost'
  | 'inputTokenCostPerK'
  | 'outputTokenCostPerK'
  | 'contextTokenCostPerK'
  | 'reasoningMultiplier'
  | 'fixedExtraCost'
  | 'referenceImageFixedCost'
  | 'referenceImageMultiplier'
  | 'videoInputMultiplier'
  | 'audioInputMultiplier';

export type RuleForm = {
  id?: string;
  taskType: string;
  name: string;
  modelProvider: string;
  modelName: string;
  quality: string;
  resolution: string;
  modelTier: string;
  baseUnit: string;
  baseCost: number | string;
  fixedExtraCost: number | string;
  inputTokenCostPerK: number | string;
  outputTokenCostPerK: number | string;
  contextTokenCostPerK: number | string;
  reasoningMultiplier: number | string;
  referenceImageFixedCost: number | string;
  referenceImageMultiplier: number | string;
  videoInputMultiplier: number | string;
  audioInputMultiplier: number | string;
  isActive: boolean;
};

export type BusinessTask = {
  category: 'chat' | 'image' | 'video' | 'prompt';
  taskType: string;
  defaultName: string;
  baseUnit: string;
  defaults: Partial<RuleForm>;
  fields: RuleField[];
};

export type Translate = (key: string, values?: Record<string, string | number>) => string;

export type PreviewForm = {
  quantity: number;
  seconds: number;
  inputTokens: number;
  outputTokens: number;
};

export const EMPTY_RULE: RuleForm = {
  taskType: '',
  name: '',
  modelProvider: '',
  modelName: '',
  quality: '',
  resolution: '',
  modelTier: '',
  baseUnit: 'task',
  baseCost: 0,
  fixedExtraCost: 0,
  inputTokenCostPerK: '',
  outputTokenCostPerK: '',
  contextTokenCostPerK: '',
  reasoningMultiplier: 1,
  referenceImageFixedCost: '',
  referenceImageMultiplier: '',
  videoInputMultiplier: '',
  audioInputMultiplier: '',
  isActive: true,
};

export const BUSINESS_TASKS: BusinessTask[] = [
  {
    category: 'chat',
    taskType: 'chat_message_fast',
    defaultName: 'Fast chat',
    baseUnit: 'message',
    defaults: { baseCost: 1, modelTier: 'fast', inputTokenCostPerK: 0.5, outputTokenCostPerK: 2 },
    fields: ['baseCost', 'inputTokenCostPerK', 'outputTokenCostPerK', 'contextTokenCostPerK'],
  },
  {
    category: 'chat',
    taskType: 'chat_message_standard',
    defaultName: 'Standard chat',
    baseUnit: 'message',
    defaults: { baseCost: 3, modelTier: 'standard', inputTokenCostPerK: 1, outputTokenCostPerK: 5 },
    fields: ['baseCost', 'inputTokenCostPerK', 'outputTokenCostPerK', 'contextTokenCostPerK'],
  },
  {
    category: 'chat',
    taskType: 'chat_message_reasoning',
    defaultName: 'Reasoning chat',
    baseUnit: 'message',
    defaults: { baseCost: 10, modelTier: 'pro_reasoning', inputTokenCostPerK: 3, outputTokenCostPerK: 15, reasoningMultiplier: 1.2 },
    fields: ['baseCost', 'inputTokenCostPerK', 'outputTokenCostPerK', 'contextTokenCostPerK', 'reasoningMultiplier'],
  },
  {
    category: 'image',
    taskType: 'gpt_image_2_low',
    defaultName: 'Image workbench Low',
    baseUnit: 'image',
    defaults: { baseCost: 15, quality: 'low' },
    fields: ['baseCost', 'referenceImageFixedCost'],
  },
  {
    category: 'image',
    taskType: 'gpt_image_2_medium',
    defaultName: 'Image workbench Medium',
    baseUnit: 'image',
    defaults: { baseCost: 90, quality: 'medium' },
    fields: ['baseCost', 'referenceImageFixedCost'],
  },
  {
    category: 'image',
    taskType: 'gpt_image_2_high',
    defaultName: 'Image workbench High',
    baseUnit: 'image',
    defaults: { baseCost: 350, quality: 'high' },
    fields: ['baseCost', 'referenceImageFixedCost'],
  },
  {
    category: 'image',
    taskType: 'image_generation',
    defaultName: 'Image template generation',
    baseUnit: 'image',
    defaults: { baseCost: 90 },
    fields: ['baseCost', 'referenceImageFixedCost'],
  },
  {
    category: 'video',
    taskType: 'seedance_fast_720p',
    defaultName: 'Seedance Fast 720p',
    baseUnit: 'second',
    defaults: { baseCost: 260, resolution: '720p' },
    fields: ['baseCost', 'referenceImageFixedCost', 'videoInputMultiplier', 'audioInputMultiplier'],
  },
  {
    category: 'video',
    taskType: 'seedance_480p',
    defaultName: 'Seedance 480p',
    baseUnit: 'second',
    defaults: { baseCost: 160, resolution: '480p' },
    fields: ['baseCost', 'referenceImageFixedCost', 'videoInputMultiplier', 'audioInputMultiplier'],
  },
  {
    category: 'video',
    taskType: 'seedance_720p',
    defaultName: 'Seedance 720p',
    baseUnit: 'second',
    defaults: { baseCost: 320, resolution: '720p' },
    fields: ['baseCost', 'referenceImageFixedCost', 'videoInputMultiplier', 'audioInputMultiplier'],
  },
  {
    category: 'video',
    taskType: 'seedance_1080p',
    defaultName: 'Seedance 1080p',
    baseUnit: 'second',
    defaults: { baseCost: 800, resolution: '1080p' },
    fields: ['baseCost', 'referenceImageFixedCost', 'videoInputMultiplier', 'audioInputMultiplier'],
  },
  {
    category: 'video',
    taskType: 'video_generation',
    defaultName: 'Video template generation',
    baseUnit: 'second',
    defaults: { baseCost: 320 },
    fields: ['baseCost', 'referenceImageFixedCost'],
  },
  {
    category: 'prompt',
    taskType: 'prompt_optimize_generation',
    defaultName: 'Image prompt optimization',
    baseUnit: 'task',
    defaults: { baseCost: 1, inputTokenCostPerK: 0.5, outputTokenCostPerK: 2 },
    fields: ['baseCost', 'inputTokenCostPerK', 'outputTokenCostPerK'],
  },
  {
    category: 'prompt',
    taskType: 'prompt_optimize_pro',
    defaultName: 'Artifact document AI optimization',
    baseUnit: 'task',
    defaults: { baseCost: 1, inputTokenCostPerK: 0.5, outputTokenCostPerK: 2 },
    fields: ['baseCost', 'inputTokenCostPerK', 'outputTokenCostPerK'],
  },
];

export const FIELD_META: Record<RuleField, { labelKey: string; type: 'int' | 'number'; hintKey: string }> = {
  baseCost: { labelKey: 'fields.baseCost.label', type: 'int', hintKey: 'fields.baseCost.hint' },
  inputTokenCostPerK: { labelKey: 'fields.inputTokenCostPerK.label', type: 'number', hintKey: 'fields.inputTokenCostPerK.hint' },
  outputTokenCostPerK: { labelKey: 'fields.outputTokenCostPerK.label', type: 'number', hintKey: 'fields.outputTokenCostPerK.hint' },
  contextTokenCostPerK: { labelKey: 'fields.contextTokenCostPerK.label', type: 'number', hintKey: 'fields.contextTokenCostPerK.hint' },
  reasoningMultiplier: { labelKey: 'fields.reasoningMultiplier.label', type: 'number', hintKey: 'fields.reasoningMultiplier.hint' },
  fixedExtraCost: { labelKey: 'fields.fixedExtraCost.label', type: 'int', hintKey: 'fields.fixedExtraCost.hint' },
  referenceImageFixedCost: { labelKey: 'fields.referenceImageFixedCost.label', type: 'int', hintKey: 'fields.referenceImageFixedCost.hint' },
  referenceImageMultiplier: { labelKey: 'fields.referenceImageMultiplier.label', type: 'number', hintKey: 'fields.referenceImageMultiplier.hint' },
  videoInputMultiplier: { labelKey: 'fields.videoInputMultiplier.label', type: 'number', hintKey: 'fields.videoInputMultiplier.hint' },
  audioInputMultiplier: { labelKey: 'fields.audioInputMultiplier.label', type: 'number', hintKey: 'fields.audioInputMultiplier.hint' },
};

export function getTaskName(t: Translate, task: BusinessTask) {
  return t(`tasks.${task.taskType}.name`);
}

export function getTaskDescription(t: Translate, task: BusinessTask) {
  return t(`tasks.${task.taskType}.description`);
}

function optionalText(value: unknown) {
  const text = String(value ?? '').trim();
  return text ? text : undefined;
}

function toInt(value: unknown) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function optionalInt(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  return toInt(text);
}

function optionalNumber(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  return Math.max(0, Number(text) || 0);
}

export function taskDefaults(task: BusinessTask): RuleForm {
  return {
    ...EMPTY_RULE,
    taskType: task.taskType,
    name: task.defaultName,
    baseUnit: task.baseUnit,
    ...task.defaults,
  };
}

export function ruleToForm(rule: GenerationPricingRule, task?: BusinessTask): RuleForm {
  return {
    ...taskDefaults(task ?? {
      category: 'prompt',
      taskType: rule.taskType,
      defaultName: rule.name,
      baseUnit: rule.baseUnit,
      defaults: {},
      fields: ['baseCost'],
    }),
    id: rule.id,
    taskType: rule.taskType,
    name: rule.name,
    modelProvider: rule.modelProvider ?? '',
    modelName: rule.modelName ?? '',
    quality: rule.quality ?? task?.defaults.quality ?? '',
    resolution: rule.resolution ?? task?.defaults.resolution ?? '',
    modelTier: rule.modelTier ?? task?.defaults.modelTier ?? '',
    baseUnit: rule.baseUnit,
    baseCost: rule.baseCost,
    fixedExtraCost: rule.fixedExtraCost ?? 0,
    inputTokenCostPerK: rule.inputTokenCostPerK ?? '',
    outputTokenCostPerK: rule.outputTokenCostPerK ?? '',
    contextTokenCostPerK: rule.contextTokenCostPerK ?? '',
    reasoningMultiplier: rule.reasoningMultiplier ?? 1,
    referenceImageFixedCost: rule.referenceImageFixedCost ?? '',
    referenceImageMultiplier: rule.referenceImageMultiplier ?? '',
    videoInputMultiplier: rule.videoInputMultiplier ?? '',
    audioInputMultiplier: rule.audioInputMultiplier ?? '',
    isActive: rule.isActive !== false,
  };
}

export function sanitizePayload(data: RuleForm, task?: BusinessTask) {
  const fields = new Set(task?.fields ?? ['baseCost']);
  return {
    taskType: task?.taskType ?? String(data.taskType ?? '').trim(),
    name: task?.defaultName ?? String(data.name ?? '').trim(),
    modelProvider: task ? undefined : optionalText(data.modelProvider),
    modelName: task ? undefined : optionalText(data.modelName),
    quality: optionalText(task?.defaults.quality ?? data.quality),
    resolution: optionalText(task?.defaults.resolution ?? data.resolution),
    modelTier: optionalText(task?.defaults.modelTier ?? data.modelTier),
    baseUnit: (task?.baseUnit ?? data.baseUnit) || 'task',
    baseCost: toInt(data.baseCost),
    fixedExtraCost: fields.has('fixedExtraCost') ? toInt(data.fixedExtraCost) : 0,
    inputTokenCostPerK: fields.has('inputTokenCostPerK') ? optionalNumber(data.inputTokenCostPerK) : null,
    outputTokenCostPerK: fields.has('outputTokenCostPerK') ? optionalNumber(data.outputTokenCostPerK) : null,
    contextTokenCostPerK: fields.has('contextTokenCostPerK') ? optionalNumber(data.contextTokenCostPerK) : null,
    reasoningMultiplier: fields.has('reasoningMultiplier') ? optionalNumber(data.reasoningMultiplier) ?? 1 : 1,
    referenceImageFixedCost: fields.has('referenceImageFixedCost') ? optionalInt(data.referenceImageFixedCost) : null,
    referenceImageMultiplier: fields.has('referenceImageMultiplier') ? optionalNumber(data.referenceImageMultiplier) : null,
    videoInputMultiplier: fields.has('videoInputMultiplier') ? optionalNumber(data.videoInputMultiplier) : null,
    audioInputMultiplier: fields.has('audioInputMultiplier') ? optionalNumber(data.audioInputMultiplier) : null,
    isActive: data.isActive !== false,
  };
}

export function formatRuleCost(rule: GenerationPricingRule, t: Translate) {
  const extras = [
    rule.inputTokenCostPerK ? t('cost.inputPerK', { value: rule.inputTokenCostPerK }) : '',
    rule.outputTokenCostPerK ? t('cost.outputPerK', { value: rule.outputTokenCostPerK }) : '',
    rule.referenceImageFixedCost ? t('cost.referenceImageFixed', { value: rule.referenceImageFixedCost }) : '',
  ].filter(Boolean);
  return extras.length > 0 ? t('cost.baseWithExtras', { base: rule.baseCost, extras: extras.join(' / ') }) : String(rule.baseCost);
}

export function previewDefaultsForRule(rule: GenerationPricingRule): PreviewForm {
  return {
    quantity: rule.baseUnit === 'image' ? 1 : 0,
    seconds: rule.baseUnit === 'second' ? 5 : 0,
    inputTokens: rule.inputTokenCostPerK ? 1000 : 0,
    outputTokens: rule.outputTokenCostPerK ? 500 : 0,
  };
}

export function buildPreviewPayload(rule: GenerationPricingRule, previewForm: PreviewForm): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    taskType: rule.taskType,
    modelProvider: rule.modelProvider ?? undefined,
    modelName: rule.modelName ?? undefined,
    quality: rule.quality ?? undefined,
    resolution: rule.resolution ?? undefined,
    modelTier: rule.modelTier ?? undefined,
  };
  if (previewForm.quantity > 0) payload.quantity = Number(previewForm.quantity);
  if (previewForm.seconds > 0) payload.seconds = Number(previewForm.seconds);
  if (previewForm.inputTokens > 0) payload.inputTokens = Number(previewForm.inputTokens);
  if (previewForm.outputTokens > 0) payload.outputTokens = Number(previewForm.outputTokens);
  return payload;
}
