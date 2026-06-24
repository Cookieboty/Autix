import {
  hasChatCapability,
  hasImageCapability,
  isVideoModel,
  type GenerationPricingRule,
  type ModelConfigItem,
} from '@autix/shared-store';
import {
  canSharePricingRuleModels,
  scopeOptionsForTask,
  type PricingScopeModel,
  type ScopeField,
} from './task-costs-scope-options';

export {
  scopeOptionsForTask,
  canSharePricingRuleModels,
  type PricingScopeModel,
  type PricingScopeOption,
  type ScopeField,
} from './task-costs-scope-options';

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
  qualities: string[];
  resolutions: string[];
  modelTiers: string[];
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
  qualities: [],
  resolutions: [],
  modelTiers: [],
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
    defaults: { baseCost: 1, modelTiers: ['fast'], inputTokenCostPerK: 0.5, outputTokenCostPerK: 2 },
    fields: ['baseCost', 'inputTokenCostPerK', 'outputTokenCostPerK', 'contextTokenCostPerK', 'toolCallCost', 'mcpCallCost', 'skillCallCost'],
  },
  {
    category: 'chat',
    taskType: 'chat_message_standard',
    defaultName: 'Standard chat',
    baseUnit: 'message',
    defaults: { baseCost: 3, modelTiers: ['standard'], inputTokenCostPerK: 1, outputTokenCostPerK: 5 },
    fields: ['baseCost', 'inputTokenCostPerK', 'outputTokenCostPerK', 'contextTokenCostPerK', 'toolCallCost', 'mcpCallCost', 'skillCallCost'],
  },
  {
    category: 'chat',
    taskType: 'chat_message_reasoning',
    defaultName: 'Reasoning chat',
    baseUnit: 'message',
    defaults: { baseCost: 10, modelTiers: ['pro_reasoning'], inputTokenCostPerK: 3, outputTokenCostPerK: 15, reasoningMultiplier: 1.2 },
    fields: ['baseCost', 'inputTokenCostPerK', 'outputTokenCostPerK', 'contextTokenCostPerK', 'toolCallCost', 'mcpCallCost', 'skillCallCost', 'reasoningMultiplier'],
  },
  {
    category: 'image',
    taskType: 'image_generation',
    defaultName: 'Image generation',
    baseUnit: 'image',
    defaults: { baseCost: 90, qualities: ['medium'] },
    fields: ['baseCost', 'referenceImageFixedCost', 'referenceImageMultiplier'],
  },
  {
    category: 'video',
    taskType: 'video_generation',
    defaultName: 'Video generation',
    baseUnit: 'second',
    defaults: { baseCost: 320, resolutions: ['720p'] },
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
    taskType: 'video_template_optimize',
    defaultName: 'Video template optimization',
    baseUnit: 'task',
    defaults: { baseCost: 1, inputTokenCostPerK: 0.5, outputTokenCostPerK: 2 },
    fields: ['baseCost', 'inputTokenCostPerK', 'outputTokenCostPerK', 'contextTokenCostPerK'],
  },
  {
    category: 'prompt',
    taskType: 'video_storyboard_optimize',
    defaultName: 'Video storyboard optimization',
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

export function pricingScopeModelsForForm(
  task: BusinessTask | undefined,
  systemModels: ModelConfigItem[],
  modelKeys: string[],
) {
  const selectableModels = modelsForBusinessTask(task, systemModels);
  const selectedKeySet = new Set(modelKeys);
  const selectedModels = selectableModels.filter((model) =>
    selectedKeySet.has(modelKeyFromSystemModel(model)),
  );
  return selectedModels.length > 0 ? selectedModels : selectableModels;
}

function compatibleModelKeysForTask(
  task: BusinessTask | undefined,
  systemModels: ModelConfigItem[] | undefined,
  modelKeys: string[],
) {
  if (!systemModels || modelKeys.length <= 1) return modelKeys;
  const selectableModels = modelsForBusinessTask(task, systemModels);
  const selectedModels: ModelConfigItem[] = [];
  const acceptedKeys: string[] = [];
  for (const key of modelKeys) {
    const model = selectableModels.find((item) => modelKeyFromSystemModel(item) === key);
    if (!model) continue;
    if (canSharePricingRuleModels(task, [...selectedModels, model])) {
      selectedModels.push(model);
      acceptedKeys.push(key);
    }
  }
  return acceptedKeys;
}

export function showScopeField(task: BusinessTask | undefined, field: ScopeField) {
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

function uniqueTextList(values: unknown[]) {
  const seen = new Set<string>();
  return values.reduce<string[]>((items, value) => {
    const text = optionalText(value);
    if (!text || seen.has(text)) return items;
    seen.add(text);
    items.push(text);
    return items;
  }, []);
}

function optionalScopeValues(
  task: BusinessTask | undefined,
  field: ScopeField,
  values: unknown[],
  models?: PricingScopeModel[],
) {
  const selectedValues = uniqueTextList(values);
  if (selectedValues.length === 0) return [];
  const options = scopeOptionsForTask(task, field, models);
  if (!task) return selectedValues;
  const optionValues = new Set(options.map((option) => option.value));
  return selectedValues.filter((value) => optionValues.has(value));
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

function conditionTexts(value: unknown) {
  return Array.from(new Set(stringListFromCondition(value)));
}

function conditionIn(values: string[]) {
  if (values.length === 0) return undefined;
  return { in: values };
}

function scopedCondition(field: ScopeField, values: string[]) {
  const condition = conditionIn(values);
  return condition ? { [field]: condition } : {};
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
  const formatValues = (values: string[]) => values.join(', ');
  const scopeParts = [
    modelScopeLabel(rule, t),
    formatValues(conditionTexts(conditions?.modelTier)),
    formatValues(conditionTexts(conditions?.quality)),
    formatValues(conditionTexts(conditions?.resolution)),
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

export function ruleToForm(rule: GenerationPricingRule, task: BusinessTask): RuleForm {
  const conditions = recordOrNull(rule.conditions);
  const modelKeys = modelKeysFromRule(rule);
  const duration = secondsRangeFromConditions(conditions);
  return {
    ...taskDefaults(task),
    id: rule.id,
    taskType: rule.taskType,
    name: rule.name,
    modelKeys,
    qualities: conditionTexts(conditions?.quality).length > 0
      ? conditionTexts(conditions?.quality)
      : (task.defaults.qualities ?? []),
    resolutions: conditionTexts(conditions?.resolution).length > 0
      ? conditionTexts(conditions?.resolution)
      : (task.defaults.resolutions ?? []),
    modelTiers: conditionTexts(conditions?.modelTier).length > 0
      ? conditionTexts(conditions?.modelTier)
      : (task.defaults.modelTiers ?? []),
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

export function sanitizePayload(data: RuleForm, task: BusinessTask, scopeModels?: PricingScopeModel[]) {
  const fields = new Set<RuleField>(task?.fields ?? ['baseCost']);
  const modelKeys = compatibleModelKeysForTask(
    task,
    scopeModels as ModelConfigItem[] | undefined,
    Array.from(new Set(data.modelKeys.map((key) => key.trim()).filter(Boolean))),
  );
  const minDurationSeconds = optionalInt(data.minDurationSeconds);
  const maxDurationSeconds = optionalInt(data.maxDurationSeconds);
  const modelTiers = optionalScopeValues(task, 'modelTier', data.modelTiers, scopeModels);
  const qualities = optionalScopeValues(task, 'quality', data.qualities, scopeModels);
  const resolutions = optionalScopeValues(task, 'resolution', data.resolutions, scopeModels);
  const conditions = {
    ...(conditionsWithoutGeneratedScope(data.conditions) ?? {}),
    ...(modelKeys.length > 0 ? { modelKey: { in: modelKeys } } : {}),
    ...(showScopeField(task, 'modelTier') ? scopedCondition('modelTier', modelTiers) : {}),
    ...(showScopeField(task, 'quality') ? scopedCondition('quality', qualities) : {}),
    ...(showScopeField(task, 'resolution') ? scopedCondition('resolution', resolutions) : {}),
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
    taskType: task.taskType,
    name: optionalText(data.name) ?? task.defaultName,
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
  const firstConditionValue = (value: unknown) => conditionTexts(value)[0] || undefined;
  const payload: Record<string, unknown> = {
    taskType: rule.taskType,
    modelProvider: scopedModel?.provider ?? undefined,
    modelName: scopedModel?.modelName ?? undefined,
    quality: firstConditionValue(conditions?.quality),
    resolution: firstConditionValue(conditions?.resolution),
    modelTier: firstConditionValue(conditions?.modelTier),
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
