import {
  hasChatCapability,
  hasImageCapability,
  isVideoModel,
  type GenerationPricingRule,
  type ModelConfigItem,
} from '@autix/shared-store';

export type RuleField =
  | 'baseCost'
  | 'inputTokenCostPerK'
  | 'outputTokenCostPerK'
  | 'contextTokenCostPerK'
  | 'toolCallCost'
  | 'mcpCallCost'
  | 'skillCallCost'
  | 'batchUnitCost'
  | 'reasoningMultiplier'
  | 'fixedExtraCost'
  | 'referenceImageFixedCost'
  | 'referenceImageMultiplier'
  | 'videoInputMultiplier'
  | 'audioInputMultiplier'
  | 'priorityMultiplier';

export type RuleForm = {
  id?: string;
  taskType: string;
  name: string;
  modelKeys: string[];
  quality: string;
  resolution: string;
  modelTier: string;
  conditions: Record<string, unknown> | null;
  priority: number | string;
  minDurationSeconds: number | string;
  maxDurationSeconds: number | string;
  baseUnit: string;
  baseCost: number | string;
  fixedExtraCost: number | string;
  inputTokenCostPerK: number | string;
  outputTokenCostPerK: number | string;
  contextTokenCostPerK: number | string;
  toolCallCost: number | string;
  mcpCallCost: number | string;
  skillCallCost: number | string;
  batchUnitCost: number | string;
  reasoningMultiplier: number | string;
  referenceImageFixedCost: number | string;
  referenceImageMultiplier: number | string;
  videoInputMultiplier: number | string;
  audioInputMultiplier: number | string;
  priorityMultiplier: number | string;
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
  contextTokens: number;
  toolCalls: number;
  mcpCalls: number;
  skillCalls: number;
  batchCount: number;
  referenceImages: number;
  hasVideoInput: boolean;
  hasAudioInput: boolean;
  priority: boolean;
};

type SanitizedRulePayload = {
  baseUnit: string;
  baseCost: number;
  fixedExtraCost: number;
  inputTokenCostPerK: number | null;
  outputTokenCostPerK: number | null;
  contextTokenCostPerK: number | null;
  toolCallCost: number | null;
  batchUnitCost: number | null;
  reasoningMultiplier: number;
  referenceImageFixedCost: number | null;
  referenceImageMultiplier: number | null;
  videoInputMultiplier: number | null;
  audioInputMultiplier: number | null;
  priorityMultiplier: number | null;
  isActive: boolean;
};

export const EMPTY_RULE: RuleForm = {
  taskType: '',
  name: '',
  modelKeys: [],
  quality: '',
  resolution: '',
  modelTier: '',
  conditions: null,
  priority: 0,
  minDurationSeconds: '',
  maxDurationSeconds: '',
  baseUnit: 'task',
  baseCost: 0,
  fixedExtraCost: 0,
  inputTokenCostPerK: '',
  outputTokenCostPerK: '',
  contextTokenCostPerK: '',
  toolCallCost: '',
  mcpCallCost: '',
  skillCallCost: '',
  batchUnitCost: '',
  reasoningMultiplier: 1,
  referenceImageFixedCost: '',
  referenceImageMultiplier: '',
  videoInputMultiplier: '',
  audioInputMultiplier: '',
  priorityMultiplier: '',
  isActive: true,
};

export const BUSINESS_TASKS: BusinessTask[] = [
  {
    category: 'chat',
    taskType: 'chat_message_fast',
    defaultName: 'Fast chat',
    baseUnit: 'message',
    defaults: { baseCost: 1, modelTier: 'fast', inputTokenCostPerK: 0.5, outputTokenCostPerK: 2 },
    fields: ['baseCost', 'inputTokenCostPerK', 'outputTokenCostPerK', 'contextTokenCostPerK', 'toolCallCost', 'mcpCallCost', 'skillCallCost'],
  },
  {
    category: 'chat',
    taskType: 'chat_message_standard',
    defaultName: 'Standard chat',
    baseUnit: 'message',
    defaults: { baseCost: 3, modelTier: 'standard', inputTokenCostPerK: 1, outputTokenCostPerK: 5 },
    fields: ['baseCost', 'inputTokenCostPerK', 'outputTokenCostPerK', 'contextTokenCostPerK', 'toolCallCost', 'mcpCallCost', 'skillCallCost'],
  },
  {
    category: 'chat',
    taskType: 'chat_message_reasoning',
    defaultName: 'Reasoning chat',
    baseUnit: 'message',
    defaults: { baseCost: 10, modelTier: 'pro_reasoning', inputTokenCostPerK: 3, outputTokenCostPerK: 15, reasoningMultiplier: 1.2 },
    fields: ['baseCost', 'inputTokenCostPerK', 'outputTokenCostPerK', 'contextTokenCostPerK', 'toolCallCost', 'mcpCallCost', 'skillCallCost', 'reasoningMultiplier'],
  },
  {
    category: 'image',
    taskType: 'gpt_image_2_low',
    defaultName: 'Image workbench Low',
    baseUnit: 'image',
    defaults: { baseCost: 15, quality: 'low' },
    fields: ['baseCost', 'referenceImageFixedCost', 'referenceImageMultiplier'],
  },
  {
    category: 'image',
    taskType: 'gpt_image_2_medium',
    defaultName: 'Image workbench Medium',
    baseUnit: 'image',
    defaults: { baseCost: 90, quality: 'medium' },
    fields: ['baseCost', 'referenceImageFixedCost', 'referenceImageMultiplier'],
  },
  {
    category: 'image',
    taskType: 'gpt_image_2_high',
    defaultName: 'Image workbench High',
    baseUnit: 'image',
    defaults: { baseCost: 350, quality: 'high' },
    fields: ['baseCost', 'referenceImageFixedCost', 'referenceImageMultiplier'],
  },
  {
    category: 'image',
    taskType: 'image_generation',
    defaultName: 'Image template generation',
    baseUnit: 'image',
    defaults: { baseCost: 90 },
    fields: ['baseCost', 'referenceImageFixedCost', 'referenceImageMultiplier'],
  },
  {
    category: 'video',
    taskType: 'seedance_fast_720p',
    defaultName: 'Seedance Fast 720p',
    baseUnit: 'second',
    defaults: { baseCost: 260, resolution: '720p' },
    fields: ['baseCost', 'referenceImageFixedCost', 'videoInputMultiplier', 'audioInputMultiplier', 'priorityMultiplier'],
  },
  {
    category: 'video',
    taskType: 'seedance_480p',
    defaultName: 'Seedance 480p',
    baseUnit: 'second',
    defaults: { baseCost: 160, resolution: '480p' },
    fields: ['baseCost', 'referenceImageFixedCost', 'videoInputMultiplier', 'audioInputMultiplier', 'priorityMultiplier'],
  },
  {
    category: 'video',
    taskType: 'seedance_720p',
    defaultName: 'Seedance 720p',
    baseUnit: 'second',
    defaults: { baseCost: 320, resolution: '720p' },
    fields: ['baseCost', 'referenceImageFixedCost', 'videoInputMultiplier', 'audioInputMultiplier', 'priorityMultiplier'],
  },
  {
    category: 'video',
    taskType: 'seedance_1080p',
    defaultName: 'Seedance 1080p',
    baseUnit: 'second',
    defaults: { baseCost: 800, resolution: '1080p' },
    fields: ['baseCost', 'referenceImageFixedCost', 'videoInputMultiplier', 'audioInputMultiplier', 'priorityMultiplier'],
  },
  {
    category: 'video',
    taskType: 'video_generation',
    defaultName: 'Video template generation',
    baseUnit: 'second',
    defaults: { baseCost: 320 },
    fields: ['baseCost', 'referenceImageFixedCost', 'videoInputMultiplier', 'audioInputMultiplier', 'priorityMultiplier'],
  },
  {
    category: 'prompt',
    taskType: 'prompt_optimize_generation',
    defaultName: 'Image prompt optimization',
    baseUnit: 'task',
    defaults: { baseCost: 1, inputTokenCostPerK: 0.5, outputTokenCostPerK: 2 },
    fields: ['baseCost', 'inputTokenCostPerK', 'outputTokenCostPerK', 'contextTokenCostPerK'],
  },
  {
    category: 'prompt',
    taskType: 'prompt_optimize_pro',
    defaultName: 'Artifact document AI optimization',
    baseUnit: 'task',
    defaults: { baseCost: 1, inputTokenCostPerK: 0.5, outputTokenCostPerK: 2 },
    fields: ['baseCost', 'inputTokenCostPerK', 'outputTokenCostPerK', 'contextTokenCostPerK'],
  },
];

export const FIELD_META: Record<RuleField, { labelKey: string; type: 'int' | 'number'; hintKey: string }> = {
  baseCost: { labelKey: 'fields.baseCost.label', type: 'int', hintKey: 'fields.baseCost.hint' },
  inputTokenCostPerK: { labelKey: 'fields.inputTokenCostPerK.label', type: 'number', hintKey: 'fields.inputTokenCostPerK.hint' },
  outputTokenCostPerK: { labelKey: 'fields.outputTokenCostPerK.label', type: 'number', hintKey: 'fields.outputTokenCostPerK.hint' },
  contextTokenCostPerK: { labelKey: 'fields.contextTokenCostPerK.label', type: 'number', hintKey: 'fields.contextTokenCostPerK.hint' },
  toolCallCost: { labelKey: 'fields.toolCallCost.label', type: 'int', hintKey: 'fields.toolCallCost.hint' },
  mcpCallCost: { labelKey: 'fields.mcpCallCost.label', type: 'int', hintKey: 'fields.mcpCallCost.hint' },
  skillCallCost: { labelKey: 'fields.skillCallCost.label', type: 'int', hintKey: 'fields.skillCallCost.hint' },
  batchUnitCost: { labelKey: 'fields.batchUnitCost.label', type: 'int', hintKey: 'fields.batchUnitCost.hint' },
  reasoningMultiplier: { labelKey: 'fields.reasoningMultiplier.label', type: 'number', hintKey: 'fields.reasoningMultiplier.hint' },
  fixedExtraCost: { labelKey: 'fields.fixedExtraCost.label', type: 'int', hintKey: 'fields.fixedExtraCost.hint' },
  referenceImageFixedCost: { labelKey: 'fields.referenceImageFixedCost.label', type: 'int', hintKey: 'fields.referenceImageFixedCost.hint' },
  referenceImageMultiplier: { labelKey: 'fields.referenceImageMultiplier.label', type: 'number', hintKey: 'fields.referenceImageMultiplier.hint' },
  videoInputMultiplier: { labelKey: 'fields.videoInputMultiplier.label', type: 'number', hintKey: 'fields.videoInputMultiplier.hint' },
  audioInputMultiplier: { labelKey: 'fields.audioInputMultiplier.label', type: 'number', hintKey: 'fields.audioInputMultiplier.hint' },
  priorityMultiplier: { labelKey: 'fields.priorityMultiplier.label', type: 'number', hintKey: 'fields.priorityMultiplier.hint' },
};

export function getTaskName(t: Translate, task: BusinessTask) {
  return t(`tasks.${task.taskType}.name`);
}

export function getTaskDescription(t: Translate, task: BusinessTask) {
  return t(`tasks.${task.taskType}.description`);
}

export function buildPricingModelKey(provider: unknown, modelName: unknown) {
  const normalizedProvider = String(provider ?? '').trim();
  const normalizedModel = String(modelName ?? '').trim();
  if (!normalizedProvider || !normalizedModel) return '';
  return JSON.stringify([normalizedProvider, normalizedModel]);
}

export function modelKeyFromSystemModel(model: Pick<ModelConfigItem, 'provider' | 'model'>) {
  return buildPricingModelKey(model.provider, model.model);
}

export function parsePricingModelKey(key: string): { provider: string; modelName: string } | null {
  try {
    const parsed = JSON.parse(key) as unknown;
    if (
      Array.isArray(parsed) &&
      typeof parsed[0] === 'string' &&
      typeof parsed[1] === 'string' &&
      parsed[0] &&
      parsed[1]
    ) {
      return { provider: parsed[0], modelName: parsed[1] };
    }
  } catch {
    // Older local drafts used plain strings; they are handled below as best-effort labels.
  }
  return null;
}

export function modelsForBusinessTask(
  task: BusinessTask | undefined,
  systemModels: ModelConfigItem[],
) {
  if (!task) return systemModels.filter((model) => model.isActive !== false);
  return systemModels.filter((model) => {
    if (model.isActive === false) return false;
    const capabilities = model.capabilities ?? [];
    if (task.category === 'video') return isVideoModel(model);
    if (task.category === 'image') return hasImageCapability(capabilities) && !isVideoModel(model);
    return hasChatCapability(capabilities) && !hasImageCapability(capabilities) && !isVideoModel(model);
  });
}

export function showScopeField(task: BusinessTask | undefined, field: 'quality' | 'resolution' | 'modelTier') {
  if (!task) return true;
  if (field === 'quality') return task.category === 'image';
  if (field === 'resolution') return task.category === 'image' || task.category === 'video';
  if (field === 'modelTier') return task.category === 'chat';
  return false;
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

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : null;
}

function stringListFromCondition(value: unknown): string[] {
  if (typeof value === 'string') return [value].filter(Boolean);
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
  if (value && typeof value === 'object') {
    const condition = value as Record<string, unknown>;
    if (typeof condition.equals === 'string' && condition.equals) return [condition.equals];
    if (Array.isArray(condition.in)) {
      return condition.in.filter((item): item is string => typeof item === 'string' && item.length > 0);
    }
  }
  return [];
}

function modelKeysFromConditions(conditions: Record<string, unknown> | null | undefined) {
  return Array.from(new Set(stringListFromCondition(conditions?.modelKey)));
}

function conditionText(value: unknown) {
  return stringListFromCondition(value)[0] ?? '';
}

function secondsRangeFromConditions(conditions: Record<string, unknown> | null | undefined) {
  const seconds = conditions?.seconds;
  if (!seconds || typeof seconds !== 'object' || Array.isArray(seconds)) {
    return { min: '', max: '' };
  }
  const condition = seconds as Record<string, unknown>;
  return {
    min: condition.min == null ? '' : String(condition.min),
    max: condition.max == null ? '' : String(condition.max),
  };
}

function conditionsWithoutGeneratedScope(conditions: Record<string, unknown> | null | undefined) {
  const next = recordOrNull(conditions);
  if (!next) return null;
  delete next.modelKey;
  delete next.modelTier;
  delete next.quality;
  delete next.resolution;
  delete next.seconds;
  return Object.keys(next).length > 0 ? next : null;
}

export function modelKeysFromRule(rule: GenerationPricingRule) {
  return modelKeysFromConditions(recordOrNull(rule.conditions));
}

export function modelScopeLabel(rule: GenerationPricingRule, t: Translate) {
  const modelKeys = modelKeysFromRule(rule);
  if (modelKeys.length > 1) return t('modelScope.selected', { count: modelKeys.length });
  if (modelKeys.length === 1) {
    const parsed = parsePricingModelKey(modelKeys[0]);
    return parsed ? `${parsed.provider} / ${parsed.modelName}` : modelKeys[0];
  }
  return '';
}

export function formatRuleScope(rule: GenerationPricingRule, t: Translate) {
  const conditions = recordOrNull(rule.conditions);
  const seconds = secondsRangeFromConditions(conditions);
  const scopeParts = [
    modelScopeLabel(rule, t),
    conditionText(conditions?.modelTier),
    conditionText(conditions?.quality),
    conditionText(conditions?.resolution),
    seconds.min || seconds.max ? `${seconds.min || '0'}-${seconds.max || '*'}s` : '',
  ].filter(Boolean);
  return scopeParts.length > 0 ? scopeParts.join(' / ') : t('generalSpec');
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

function componentValue(rule: GenerationPricingRule, componentType: string, valueKey: 'unitCost' | 'multiplier' = 'unitCost') {
  const component = rule.components?.find((item) => item.componentType === componentType && item.isActive !== false);
  return component?.[valueKey] ?? '';
}

function baseComponentType(baseUnit: string) {
  if (baseUnit === 'image') return 'per_image';
  if (baseUnit === 'second') return 'per_second';
  return 'base';
}

export function ruleToForm(rule: GenerationPricingRule, task?: BusinessTask): RuleForm {
  const conditions = recordOrNull(rule.conditions);
  const modelKeys = modelKeysFromRule(rule);
  const duration = secondsRangeFromConditions(conditions);
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
    modelKeys,
    quality: conditionText(conditions?.quality) || (task?.defaults.quality ?? ''),
    resolution: conditionText(conditions?.resolution) || (task?.defaults.resolution ?? ''),
    modelTier: conditionText(conditions?.modelTier) || (task?.defaults.modelTier ?? ''),
    conditions: conditionsWithoutGeneratedScope(conditions),
    priority: rule.priority ?? 0,
    minDurationSeconds: duration.min,
    maxDurationSeconds: duration.max,
    baseUnit: rule.baseUnit,
    baseCost: componentValue(rule, baseComponentType(rule.baseUnit)),
    fixedExtraCost: componentValue(rule, 'fixed_extra') || 0,
    inputTokenCostPerK: componentValue(rule, 'input_token_per_1k'),
    outputTokenCostPerK: componentValue(rule, 'output_token_per_1k'),
    contextTokenCostPerK: componentValue(rule, 'context_token_per_1k'),
    toolCallCost: componentValue(rule, 'per_tool_call'),
    mcpCallCost: componentValue(rule, 'per_mcp_call'),
    skillCallCost: componentValue(rule, 'per_skill_call'),
    batchUnitCost: componentValue(rule, 'per_batch'),
    reasoningMultiplier: componentValue(rule, 'reasoning_multiplier', 'multiplier') || 1,
    referenceImageFixedCost: componentValue(rule, 'per_reference_image'),
    referenceImageMultiplier: componentValue(rule, 'reference_image_multiplier', 'multiplier'),
    videoInputMultiplier: componentValue(rule, 'video_input_multiplier', 'multiplier'),
    audioInputMultiplier: componentValue(rule, 'audio_input_multiplier', 'multiplier'),
    priorityMultiplier: componentValue(rule, 'priority_multiplier', 'multiplier'),
    isActive: rule.isActive !== false,
  };
}

export function sanitizePayload(data: RuleForm, task?: BusinessTask) {
  const fields = new Set<RuleField>(task?.fields ?? ['baseCost']);
  const modelKeys = Array.from(new Set(data.modelKeys.map((key) => key.trim()).filter(Boolean)));
  const minDurationSeconds = optionalInt(data.minDurationSeconds);
  const maxDurationSeconds = optionalInt(data.maxDurationSeconds);
  const conditions = {
    ...(conditionsWithoutGeneratedScope(data.conditions) ?? {}),
    ...(modelKeys.length > 0 ? { modelKey: { in: modelKeys } } : {}),
    ...(showScopeField(task, 'modelTier') && optionalText(data.modelTier) ? { modelTier: optionalText(data.modelTier) } : {}),
    ...(showScopeField(task, 'quality') && optionalText(data.quality) ? { quality: optionalText(data.quality) } : {}),
    ...(showScopeField(task, 'resolution') && optionalText(data.resolution) ? { resolution: optionalText(data.resolution) } : {}),
    ...(task?.category === 'video' && (minDurationSeconds != null || maxDurationSeconds != null)
      ? { seconds: { ...(minDurationSeconds != null ? { min: minDurationSeconds } : {}), ...(maxDurationSeconds != null ? { max: maxDurationSeconds } : {}) } }
      : {}),
  };
  const componentSource: SanitizedRulePayload = {
    baseUnit: (task?.baseUnit ?? data.baseUnit) || 'task',
    baseCost: toInt(data.baseCost),
    fixedExtraCost: fields.has('fixedExtraCost') ? toInt(data.fixedExtraCost) : 0,
    inputTokenCostPerK: fields.has('inputTokenCostPerK') ? optionalNumber(data.inputTokenCostPerK) : null,
    outputTokenCostPerK: fields.has('outputTokenCostPerK') ? optionalNumber(data.outputTokenCostPerK) : null,
    contextTokenCostPerK: fields.has('contextTokenCostPerK') ? optionalNumber(data.contextTokenCostPerK) : null,
    toolCallCost: fields.has('toolCallCost') ? optionalInt(data.toolCallCost) : null,
    batchUnitCost: fields.has('batchUnitCost') ? optionalInt(data.batchUnitCost) : null,
    reasoningMultiplier: fields.has('reasoningMultiplier') ? optionalNumber(data.reasoningMultiplier) ?? 1 : 1,
    referenceImageFixedCost: fields.has('referenceImageFixedCost') ? optionalInt(data.referenceImageFixedCost) : null,
    referenceImageMultiplier: fields.has('referenceImageMultiplier') ? optionalNumber(data.referenceImageMultiplier) : null,
    videoInputMultiplier: fields.has('videoInputMultiplier') ? optionalNumber(data.videoInputMultiplier) : null,
    audioInputMultiplier: fields.has('audioInputMultiplier') ? optionalNumber(data.audioInputMultiplier) : null,
    priorityMultiplier: fields.has('priorityMultiplier') ? optionalNumber(data.priorityMultiplier) : null,
    isActive: data.isActive !== false,
  };

  return {
    taskType: task?.taskType ?? String(data.taskType ?? '').trim(),
    name: optionalText(data.name) ?? task?.defaultName ?? String(data.taskType ?? '').trim(),
    baseUnit: componentSource.baseUnit,
    priority: toInt(data.priority),
    conditions: Object.keys(conditions).length > 0 ? conditions : undefined,
    components: buildRuleComponents(componentSource, data, fields),
    isActive: data.isActive !== false,
  };
}

function buildRuleComponents(
  payload: SanitizedRulePayload,
  data: RuleForm,
  fields: Set<RuleField>,
) {
  const components: Array<{
    componentType: string;
    unitCost?: number;
    multiplier?: number;
    sort: number;
    isActive: boolean;
  }> = [];
  const addAmount = (componentType: string, value: unknown, sort: number, enabled = true) => {
    if (!enabled) return;
    const amount = optionalNumber(value);
    if (amount == null || amount <= 0) return;
    components.push({ componentType, unitCost: amount, sort, isActive: true });
  };
  const addMultiplier = (componentType: string, value: unknown, sort: number, enabled = true) => {
    if (!enabled) return;
    const multiplier = optionalNumber(value);
    if (multiplier == null || multiplier === 1) return;
    components.push({ componentType, multiplier, sort, isActive: true });
  };

  const baseComponent = baseComponentType(payload.baseUnit);

  addAmount(baseComponent, payload.baseCost, 10);
  addAmount('fixed_extra', payload.fixedExtraCost, 20, fields.has('fixedExtraCost'));
  addAmount('input_token_per_1k', payload.inputTokenCostPerK, 30, fields.has('inputTokenCostPerK'));
  addAmount('output_token_per_1k', payload.outputTokenCostPerK, 40, fields.has('outputTokenCostPerK'));
  addAmount('context_token_per_1k', payload.contextTokenCostPerK, 50, fields.has('contextTokenCostPerK'));
  addAmount('per_tool_call', payload.toolCallCost, 60, fields.has('toolCallCost'));
  addAmount('per_mcp_call', data.mcpCallCost, 70, fields.has('mcpCallCost'));
  addAmount('per_skill_call', data.skillCallCost, 80, fields.has('skillCallCost'));
  addAmount('per_batch', payload.batchUnitCost, 90, fields.has('batchUnitCost'));
  addAmount('per_reference_image', payload.referenceImageFixedCost, 100, fields.has('referenceImageFixedCost'));
  addMultiplier('reasoning_multiplier', payload.reasoningMultiplier, 120, fields.has('reasoningMultiplier'));
  addMultiplier('reference_image_multiplier', payload.referenceImageMultiplier, 130, fields.has('referenceImageMultiplier'));
  addMultiplier('video_input_multiplier', payload.videoInputMultiplier, 140, fields.has('videoInputMultiplier'));
  addMultiplier('audio_input_multiplier', payload.audioInputMultiplier, 150, fields.has('audioInputMultiplier'));
  addMultiplier('priority_multiplier', payload.priorityMultiplier, 160, fields.has('priorityMultiplier'));

  return components;
}

export function formatRuleCost(rule: GenerationPricingRule, _t: Translate) {
  const components = rule.components?.filter((component) => component.isActive !== false) ?? [];
  if (components.length === 0) return '-';
  return components
    .map((component) => {
      const value = component.multiplier ?? component.unitCost ?? 0;
      const suffix = component.multiplier ? 'x' : '';
      return `${component.componentType}:${value}${suffix}`;
    })
    .join(' / ');
}

export function previewDefaultsForRule(rule: GenerationPricingRule): PreviewForm {
  const hasComponent = (type: string) => rule.components?.some((component) => component.componentType === type && component.isActive !== false);
  return {
    quantity: rule.baseUnit === 'image' || hasComponent('per_image') ? 1 : 0,
    seconds: rule.baseUnit === 'second' || hasComponent('per_second') ? 5 : 0,
    inputTokens: hasComponent('input_token_per_1k') ? 1000 : 0,
    outputTokens: hasComponent('output_token_per_1k') ? 500 : 0,
    contextTokens: hasComponent('context_token_per_1k') ? 2000 : 0,
    toolCalls: hasComponent('per_tool_call') ? 1 : 0,
    mcpCalls: hasComponent('per_mcp_call') ? 1 : 0,
    skillCalls: hasComponent('per_skill_call') ? 1 : 0,
    batchCount: hasComponent('per_batch') ? 1 : 0,
    referenceImages: hasComponent('per_reference_image') || hasComponent('reference_image_multiplier') ? 1 : 0,
    hasVideoInput: Boolean(hasComponent('video_input_multiplier')),
    hasAudioInput: Boolean(hasComponent('audio_input_multiplier')),
    priority: Boolean(hasComponent('priority_multiplier')),
  };
}

export function buildPreviewPayload(rule: GenerationPricingRule, previewForm: PreviewForm): Record<string, unknown> {
  const conditions = recordOrNull(rule.conditions);
  const scopedModel = parsePricingModelKey(modelKeysFromRule(rule)[0] ?? '');
  const payload: Record<string, unknown> = {
    taskType: rule.taskType,
    modelProvider: scopedModel?.provider ?? undefined,
    modelName: scopedModel?.modelName ?? undefined,
    quality: conditionText(conditions?.quality) || undefined,
    resolution: conditionText(conditions?.resolution) || undefined,
    modelTier: conditionText(conditions?.modelTier) || undefined,
  };
  if (previewForm.quantity > 0) payload.quantity = Number(previewForm.quantity);
  if (previewForm.seconds > 0) payload.seconds = Number(previewForm.seconds);
  if (previewForm.inputTokens > 0) payload.inputTokens = Number(previewForm.inputTokens);
  if (previewForm.outputTokens > 0) payload.outputTokens = Number(previewForm.outputTokens);
  if (previewForm.contextTokens > 0) payload.contextTokens = Number(previewForm.contextTokens);
  if (previewForm.toolCalls > 0) payload.toolCalls = Number(previewForm.toolCalls);
  if (previewForm.mcpCalls > 0) payload.mcpCalls = Number(previewForm.mcpCalls);
  if (previewForm.skillCalls > 0) payload.skillCalls = Number(previewForm.skillCalls);
  if (previewForm.batchCount > 0) payload.batchCount = Number(previewForm.batchCount);
  if (previewForm.referenceImages > 0) payload.referenceImages = Number(previewForm.referenceImages);
  if (previewForm.hasVideoInput) payload.hasVideoInput = true;
  if (previewForm.hasAudioInput) payload.hasAudioInput = true;
  if (previewForm.priority) payload.priority = true;
  return payload;
}
