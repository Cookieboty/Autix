/**
 * Framework-agnostic bidirectional mapping between a stored generation pricing
 * rule and a flat, spreadsheet-friendly "row" representation.
 *
 * This is the single source of truth for how a rule's nested `conditions` /
 * `components` are decomposed into flat fields and recomposed again. It is used
 * by:
 *   - the admin editor UI (shared-ui `task-costs-helpers.ts`), and
 *   - the Excel bulk import/export endpoints (services/api).
 *
 * PURITY CONTRACT — do not break:
 *   - No dependency on Nest DTOs, Prisma generated types, React types, or
 *     `ModelConfigItem`. This module only consumes / produces the domain-level
 *     shapes declared below.
 *   - Model-catalog validation (which models exist, whether they can share a
 *     rule) and scope-option validation are intentionally NOT done here — they
 *     require the live model catalog and belong to the caller (backend adapter
 *     / UI). This mapper trusts the values it is given.
 */
import {
  PRICING_DIMENSIONS,
  pricingConditionFieldsForCategory,
  type PricingConditionField,
  type PricingTaskCategory,
} from './pricing-dimensions';
import type { GenerationPricingRule, PricingRuleComponentType } from './index';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PricingRuleField =
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

/** Static, catalog-independent description of a business task. */
export interface PricingTaskSpec {
  taskType: string;
  category: PricingTaskCategory;
  baseUnit: string;
  fields: PricingRuleField[];
}

/** Minimal read shape of a stored rule the mapper needs (superset-compatible with GenerationPricingRule). */
export interface PricingRuleLike {
  taskType: string;
  name: string;
  baseUnit: string;
  priority?: number;
  conditions?: Record<string, unknown> | null;
  components?: Array<{
    componentType: string;
    unitCost?: string | number | null;
    multiplier?: string | number | null;
    config?: Record<string, unknown> | null;
    isActive?: boolean;
  }>;
  isActive?: boolean;
  refundPolicy?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}

/** Flat, serializable representation of a rule — one Excel row. */
export interface PricingRuleRow {
  taskType: string;
  name: string;
  baseUnit: string;
  priority: number;
  isActive: boolean;
  /** Raw model keys, each `JSON.stringify([provider, modelName])`. */
  modelKeys: string[];
  modelTiers: string[];
  qualities: string[];
  resolutions: string[];
  membershipLevels: string[];
  requireVideoInput: boolean;
  requireAudioInput: boolean;
  requirePriority: boolean;
  minDurationSeconds: number | null;
  maxDurationSeconds: number | null;
  /** Non-generated conditions preserved verbatim for round-trip. */
  extraConditions: Record<string, unknown> | null;
  baseCost: number | null;
  fixedExtraCost: number | null;
  inputTokenCostPerK: number | null;
  outputTokenCostPerK: number | null;
  contextTokenCostPerK: number | null;
  toolCallCost: number | null;
  mcpCallCost: number | null;
  skillCallCost: number | null;
  batchUnitCost: number | null;
  reasoningMultiplier: number | null;
  referenceImageFixedCost: number | null;
  referenceImageMultiplier: number | null;
  videoInputMultiplier: number | null;
  audioInputMultiplier: number | null;
  priorityMultiplier: number | null;
}

export interface PricingRuleComponentInput {
  componentType: PricingRuleComponentType;
  unitCost?: number;
  multiplier?: number;
  config?: Record<string, unknown> | null;
  sort: number;
  isActive: boolean;
}

/**
 * Domain-level upsert payload. The backend adapts this into its Prisma write
 * shape; the domain layer never references Prisma.
 */
export interface PricingRuleUpsertInput {
  taskType: string;
  name: string;
  baseUnit: string;
  priority: number;
  conditions?: Record<string, unknown>;
  components: PricingRuleComponentInput[];
  isActive: boolean;
  refundPolicy?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}

// ---------------------------------------------------------------------------
// Model key helpers (canonical — shared-ui / estimator should reuse these)
// ---------------------------------------------------------------------------

export function buildPricingModelKey(provider: unknown, modelName: unknown): string {
  const normalizedProvider = String(provider ?? '').trim();
  const normalizedModel = String(modelName ?? '').trim();
  if (!normalizedProvider || !normalizedModel) return '';
  return JSON.stringify([normalizedProvider, normalizedModel]);
}

export function parsePricingModelKey(
  key: string,
): { provider: string; modelName: string } | null {
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
    // Older drafts stored plain strings — not a valid model key.
  }
  return null;
}

// ---------------------------------------------------------------------------
// Task specs (catalog-independent config; mirrors BUSINESS_TASKS)
// ---------------------------------------------------------------------------

const CHAT_FIELDS: PricingRuleField[] = [
  'baseCost',
  'inputTokenCostPerK',
  'outputTokenCostPerK',
  'contextTokenCostPerK',
  'toolCallCost',
  'mcpCallCost',
  'skillCallCost',
];
const PROMPT_FIELDS: PricingRuleField[] = [
  'baseCost',
  'inputTokenCostPerK',
  'outputTokenCostPerK',
  'contextTokenCostPerK',
];

export const PRICING_TASK_SPECS: Record<string, PricingTaskSpec> = {
  chat_message_fast: { taskType: 'chat_message_fast', category: 'chat', baseUnit: 'message', fields: CHAT_FIELDS },
  chat_message_standard: { taskType: 'chat_message_standard', category: 'chat', baseUnit: 'message', fields: CHAT_FIELDS },
  chat_message_reasoning: { taskType: 'chat_message_reasoning', category: 'chat', baseUnit: 'message', fields: [...CHAT_FIELDS, 'reasoningMultiplier'] },
  image_generation: { taskType: 'image_generation', category: 'image', baseUnit: 'image', fields: ['baseCost', 'referenceImageFixedCost', 'referenceImageMultiplier'] },
  video_generation: { taskType: 'video_generation', category: 'video', baseUnit: 'second', fields: ['baseCost', 'referenceImageFixedCost', 'videoInputMultiplier', 'audioInputMultiplier', 'priorityMultiplier'] },
  prompt_optimize_generation: { taskType: 'prompt_optimize_generation', category: 'prompt', baseUnit: 'task', fields: PROMPT_FIELDS },
  video_template_optimize: { taskType: 'video_template_optimize', category: 'prompt', baseUnit: 'task', fields: PROMPT_FIELDS },
  video_storyboard_optimize: { taskType: 'video_storyboard_optimize', category: 'prompt', baseUnit: 'task', fields: PROMPT_FIELDS },
  prompt_optimize_pro: { taskType: 'prompt_optimize_pro', category: 'prompt', baseUnit: 'task', fields: PROMPT_FIELDS },
};

export function resolvePricingTaskSpec(taskType: string): PricingTaskSpec | undefined {
  return PRICING_TASK_SPECS[taskType];
}

// ---------------------------------------------------------------------------
// Internal coercion / condition helpers (ported, pure)
// ---------------------------------------------------------------------------

const REGISTERED_CONDITION_FIELDS = new Set<string>(
  PRICING_DIMENSIONS.filter((d) => d.condition).map((d) => d.field),
);

function toInt(value: unknown): number {
  return Math.max(0, Math.floor(Number(value) || 0));
}
function optionalInt(value: unknown): number | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  return toInt(text);
}
function optionalNumber(value: unknown): number | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  return Math.max(0, Number(text) || 0);
}
function optionalText(value: unknown): string | undefined {
  const text = String(value ?? '').trim();
  return text ? text : undefined;
}
function uniqueTextList(values: unknown[]): string[] {
  const seen = new Set<string>();
  return values.reduce<string[]>((items, value) => {
    const text = optionalText(value);
    if (!text || seen.has(text)) return items;
    seen.add(text);
    items.push(text);
    return items;
  }, []);
}
function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : null;
}
function stringListFromCondition(value: unknown): string[] {
  if (typeof value === 'string') return [value].filter(Boolean);
  if (Array.isArray(value)) return value.filter((i): i is string => typeof i === 'string' && i.length > 0);
  if (value && typeof value === 'object') {
    const c = value as Record<string, unknown>;
    if (typeof c.equals === 'string' && c.equals) return [c.equals];
    if (Array.isArray(c.in)) return c.in.filter((i): i is string => typeof i === 'string' && i.length > 0);
  }
  return [];
}
function scopeTextListFromCondition(value: unknown): string[] {
  if (typeof value === 'number' && Number.isFinite(value)) return [String(value)];
  if (typeof value === 'boolean') return [String(value)];
  if (Array.isArray(value)) {
    return value
      .filter((i): i is string | number | boolean => typeof i === 'string' || typeof i === 'number' || typeof i === 'boolean')
      .map(String)
      .filter(Boolean);
  }
  if (value && typeof value === 'object') {
    const c = value as Record<string, unknown>;
    if (typeof c.equals === 'string' || typeof c.equals === 'number' || typeof c.equals === 'boolean') {
      return [String(c.equals)].filter(Boolean);
    }
    if (Array.isArray(c.in)) {
      return c.in
        .filter((i): i is string | number | boolean => typeof i === 'string' || typeof i === 'number' || typeof i === 'boolean')
        .map(String)
        .filter(Boolean);
    }
  }
  return stringListFromCondition(value);
}
function booleanFromCondition(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const c = value as Record<string, unknown>;
    if (typeof c.equals === 'boolean') return c.equals;
    if (Array.isArray(c.in)) return c.in.includes(true);
  }
  return false;
}
function conditionTexts(value: unknown): string[] {
  return Array.from(new Set(scopeTextListFromCondition(value)));
}
function modelKeysFromConditions(conditions: Record<string, unknown> | null | undefined): string[] {
  return Array.from(new Set(stringListFromCondition(conditions?.modelKey)));
}
function conditionIn(values: string[]): { in: string[] } | undefined {
  return values.length === 0 ? undefined : { in: values };
}
function numberConditionIn(values: string[]): { in: number[] } | undefined {
  const numbers = values.map(Number).filter((v) => Number.isFinite(v));
  return numbers.length === 0 ? undefined : { in: Array.from(new Set(numbers)) };
}
function scopedCondition(field: PricingConditionField, values: string[]): Record<string, unknown> {
  const condition = field === 'membershipLevel' ? numberConditionIn(values) : conditionIn(values);
  return condition ? { [field]: condition } : {};
}
function secondsRangeFromConditions(
  conditions: Record<string, unknown> | null | undefined,
): { min: number | null; max: number | null } {
  const seconds = conditions?.seconds;
  if (!seconds || typeof seconds !== 'object' || Array.isArray(seconds)) return { min: null, max: null };
  const c = seconds as Record<string, unknown>;
  return {
    min: c.min == null ? null : optionalInt(c.min),
    max: c.max == null ? null : optionalInt(c.max),
  };
}
function conditionsWithoutGeneratedScope(
  conditions: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  const next = recordOrNull(conditions);
  if (!next) return null;
  for (const field of REGISTERED_CONDITION_FIELDS) delete next[field];
  return Object.keys(next).length > 0 ? next : null;
}
function baseComponentType(baseUnit: string): PricingRuleComponentType {
  if (baseUnit === 'image') return 'per_image';
  if (baseUnit === 'second') return 'per_second';
  return 'base';
}
function readComponent(
  rule: PricingRuleLike,
  componentType: string,
  key: 'unitCost' | 'multiplier' = 'unitCost',
): number | null {
  const component = rule.components?.find((c) => c.componentType === componentType && c.isActive !== false);
  const raw = component?.[key];
  if (raw == null || raw === '') return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

// ---------------------------------------------------------------------------
// rule -> row  (decompose)
// ---------------------------------------------------------------------------

export function ruleToRow(rule: PricingRuleLike): PricingRuleRow {
  const conditions = recordOrNull(rule.conditions);
  const duration = secondsRangeFromConditions(conditions);
  return {
    taskType: rule.taskType,
    name: rule.name,
    baseUnit: rule.baseUnit,
    priority: rule.priority ?? 0,
    isActive: rule.isActive !== false,
    modelKeys: modelKeysFromConditions(conditions),
    modelTiers: conditionTexts(conditions?.modelTier),
    qualities: conditionTexts(conditions?.quality),
    resolutions: conditionTexts(conditions?.resolution),
    membershipLevels: conditionTexts(conditions?.membershipLevel),
    requireVideoInput: booleanFromCondition(conditions?.hasVideoInput),
    requireAudioInput: booleanFromCondition(conditions?.hasAudioInput),
    requirePriority: booleanFromCondition(conditions?.priority),
    minDurationSeconds: duration.min,
    maxDurationSeconds: duration.max,
    extraConditions: conditionsWithoutGeneratedScope(conditions),
    baseCost: readComponent(rule, baseComponentType(rule.baseUnit)),
    fixedExtraCost: readComponent(rule, 'fixed_extra'),
    inputTokenCostPerK: readComponent(rule, 'input_token_per_1k'),
    outputTokenCostPerK: readComponent(rule, 'output_token_per_1k'),
    contextTokenCostPerK: readComponent(rule, 'context_token_per_1k'),
    toolCallCost: readComponent(rule, 'per_tool_call'),
    mcpCallCost: readComponent(rule, 'per_mcp_call'),
    skillCallCost: readComponent(rule, 'per_skill_call'),
    batchUnitCost: readComponent(rule, 'per_batch'),
    reasoningMultiplier: readComponent(rule, 'reasoning_multiplier', 'multiplier'),
    referenceImageFixedCost: readComponent(rule, 'per_reference_image'),
    referenceImageMultiplier: readComponent(rule, 'reference_image_multiplier', 'multiplier'),
    videoInputMultiplier: readComponent(rule, 'video_input_multiplier', 'multiplier'),
    audioInputMultiplier: readComponent(rule, 'audio_input_multiplier', 'multiplier'),
    priorityMultiplier: readComponent(rule, 'priority_multiplier', 'multiplier'),
  };
}

// ---------------------------------------------------------------------------
// row -> upsert  (recompose)
// ---------------------------------------------------------------------------

function buildConditions(row: PricingRuleRow, spec: PricingTaskSpec): Record<string, unknown> {
  const allowed = new Set<PricingConditionField>(pricingConditionFieldsForCategory(spec.category));
  const modelKeys = uniqueTextList(row.modelKeys);
  const gated = (field: PricingConditionField, values: string[]) =>
    allowed.has(field) ? scopedCondition(field, uniqueTextList(values)) : {};
  const isVideo = spec.category === 'video';
  const min = optionalInt(row.minDurationSeconds);
  const max = optionalInt(row.maxDurationSeconds);
  return {
    ...(conditionsWithoutGeneratedScope(row.extraConditions) ?? {}),
    ...(modelKeys.length > 0 ? { modelKey: { in: modelKeys } } : {}),
    ...gated('modelTier', row.modelTiers),
    ...gated('quality', row.qualities),
    ...gated('resolution', row.resolutions),
    ...gated('membershipLevel', row.membershipLevels),
    ...(isVideo && row.requireVideoInput ? { hasVideoInput: true } : {}),
    ...(isVideo && row.requireAudioInput ? { hasAudioInput: true } : {}),
    ...(isVideo && row.requirePriority ? { priority: true } : {}),
    ...(isVideo && (min != null || max != null)
      ? { seconds: { ...(min != null ? { min } : {}), ...(max != null ? { max } : {}) } }
      : {}),
  };
}

function buildComponents(row: PricingRuleRow, spec: PricingTaskSpec): PricingRuleComponentInput[] {
  const fields = new Set<PricingRuleField>(spec.fields);
  const components: PricingRuleComponentInput[] = [];
  // `integer` mirrors sanitizePayload: base/fixed_extra/tool/batch/reference-image
  // costs are floored to ints; token costs and mcp/skill costs stay fractional.
  const addAmount = (
    componentType: PricingRuleComponentType,
    value: number | null,
    sort: number,
    enabled = true,
    integer = false,
  ) => {
    if (!enabled) return;
    const amount = integer ? optionalInt(value) : optionalNumber(value);
    if (amount == null || amount <= 0) return;
    components.push({ componentType, unitCost: amount, sort, isActive: true });
  };
  const addMultiplier = (
    componentType: PricingRuleComponentType,
    value: number | null,
    sort: number,
    enabled = true,
  ) => {
    if (!enabled) return;
    const multiplier = optionalNumber(value);
    if (multiplier == null || multiplier === 1) return;
    components.push({ componentType, multiplier, sort, isActive: true });
  };

  addAmount(baseComponentType(spec.baseUnit), row.baseCost, 10, true, true);
  addAmount('fixed_extra', row.fixedExtraCost, 20, fields.has('fixedExtraCost'), true);
  addAmount('input_token_per_1k', row.inputTokenCostPerK, 30, fields.has('inputTokenCostPerK'));
  addAmount('output_token_per_1k', row.outputTokenCostPerK, 40, fields.has('outputTokenCostPerK'));
  addAmount('context_token_per_1k', row.contextTokenCostPerK, 50, fields.has('contextTokenCostPerK'));
  addAmount('per_tool_call', row.toolCallCost, 60, fields.has('toolCallCost'), true);
  addAmount('per_mcp_call', row.mcpCallCost, 70, fields.has('mcpCallCost'));
  addAmount('per_skill_call', row.skillCallCost, 80, fields.has('skillCallCost'));
  addAmount('per_batch', row.batchUnitCost, 90, fields.has('batchUnitCost'), true);
  addAmount('per_reference_image', row.referenceImageFixedCost, 100, fields.has('referenceImageFixedCost'), true);
  addMultiplier('reasoning_multiplier', row.reasoningMultiplier, 120, fields.has('reasoningMultiplier'));
  addMultiplier('reference_image_multiplier', row.referenceImageMultiplier, 130, fields.has('referenceImageMultiplier'));
  addMultiplier('video_input_multiplier', row.videoInputMultiplier, 140, fields.has('videoInputMultiplier'));
  addMultiplier('audio_input_multiplier', row.audioInputMultiplier, 150, fields.has('audioInputMultiplier'));
  addMultiplier('priority_multiplier', row.priorityMultiplier, 160, fields.has('priorityMultiplier'));

  return components;
}

/**
 * Recompose a flat row into an upsert payload.
 *
 * @param existing  When updating an existing rule, its previously-stored value.
 *   Fields NOT represented in the Excel row are preserved from it:
 *     - rule level: refundPolicy / metadata / effectiveFrom / effectiveTo
 *     - component level: `config`, carried over by matching componentType
 *   This prevents a spreadsheet round-trip from silently nulling advanced data.
 */
export function rowToUpsert(
  row: PricingRuleRow,
  options?: { existing?: PricingRuleLike; spec?: PricingTaskSpec },
): PricingRuleUpsertInput {
  const spec = options?.spec ?? resolvePricingTaskSpec(row.taskType);
  if (!spec) {
    throw new Error(`Unknown pricing taskType: ${row.taskType}`);
  }
  const baseUnit = spec.baseUnit || row.baseUnit || 'task';
  const existing = options?.existing;
  const rowForBuild: PricingRuleRow = {
    ...row,
    baseUnit,
    // On update, unknown (non-generated) conditions have no spreadsheet column,
    // so rebuilding from `row` alone would silently drop them — preserve from existing.
    ...(existing ? { extraConditions: conditionsWithoutGeneratedScope(existing.conditions) } : {}),
  };
  const conditions = buildConditions(rowForBuild, spec);
  const components = buildComponents(rowForBuild, spec);

  if (existing) {
    const configByType = new Map<string, Record<string, unknown> | null | undefined>();
    for (const c of existing.components ?? []) {
      if (c.config != null) configByType.set(c.componentType, c.config);
    }
    for (const component of components) {
      const carried = configByType.get(component.componentType);
      if (carried != null) component.config = carried;
    }
  }

  return {
    taskType: spec.taskType,
    name: optionalText(row.name) ?? spec.taskType,
    baseUnit,
    priority: toInt(row.priority),
    conditions: Object.keys(conditions).length > 0 ? conditions : undefined,
    components,
    isActive: row.isActive !== false,
    ...(existing
      ? {
          refundPolicy: existing.refundPolicy ?? null,
          metadata: existing.metadata ?? null,
          effectiveFrom: existing.effectiveFrom ?? null,
          effectiveTo: existing.effectiveTo ?? null,
        }
      : {}),
  };
}

/** Convenience for callers holding a full `GenerationPricingRule`. */
export function generationRuleToRow(rule: GenerationPricingRule): PricingRuleRow {
  return ruleToRow(rule);
}

// ---------------------------------------------------------------------------
// expandPricingMatrix — flatten (model × quality × resolution × tier) into one
// row per combination, pre-filled from the best-matching existing rule.
// ---------------------------------------------------------------------------

export interface PricingMatrixModel {
  provider: string;
  modelName: string;
}

export interface PricingMatrixDims {
  qualities?: string[];
  resolutions?: string[];
  modelTiers?: string[];
}

function emptyRow(taskType: string, baseUnit: string): PricingRuleRow {
  return {
    taskType,
    name: '',
    baseUnit,
    priority: 0,
    isActive: true,
    modelKeys: [],
    modelTiers: [],
    qualities: [],
    resolutions: [],
    membershipLevels: [],
    requireVideoInput: false,
    requireAudioInput: false,
    requirePriority: false,
    minDurationSeconds: null,
    maxDurationSeconds: null,
    extraConditions: null,
    baseCost: null,
    fixedExtraCost: null,
    inputTokenCostPerK: null,
    outputTokenCostPerK: null,
    contextTokenCostPerK: null,
    toolCallCost: null,
    mcpCallCost: null,
    skillCallCost: null,
    batchUnitCost: null,
    referenceImageFixedCost: null,
    reasoningMultiplier: null,
    referenceImageMultiplier: null,
    videoInputMultiplier: null,
    audioInputMultiplier: null,
    priorityMultiplier: null,
  };
}

function comboName(modelName: string, parts: Array<string | undefined>): string {
  const name = [modelName, ...parts.filter((p): p is string => !!p)].join(' · ');
  return name.length > 64 ? name.slice(0, 64) : name;
}

/** Score how well an existing (already-decomposed) rule row fits a combo; -1 = no match. */
function matchScore(
  rule: PricingRuleRow,
  combo: { modelKey: string; quality?: string; resolution?: string; tier?: string },
): number {
  const modelIncluded = rule.modelKeys.includes(combo.modelKey);
  if (rule.modelKeys.length > 0 && !modelIncluded) return -1;
  if (combo.quality && rule.qualities.length > 0 && !rule.qualities.includes(combo.quality)) return -1;
  if (combo.resolution && rule.resolutions.length > 0 && !rule.resolutions.includes(combo.resolution)) return -1;
  if (combo.tier && rule.modelTiers.length > 0 && !rule.modelTiers.includes(combo.tier)) return -1;
  let score = rule.priority * 0.001;
  if (modelIncluded) score += 4;
  if (combo.quality && rule.qualities.includes(combo.quality)) score += 2;
  if (combo.resolution && rule.resolutions.includes(combo.resolution)) score += 2;
  if (combo.tier && rule.modelTiers.includes(combo.tier)) score += 1;
  return score;
}

/**
 * Build a fully-flattened template: one row per (model × quality × resolution ×
 * tier) combination. Empty dimension arrays collapse to a single "generic" pass,
 * so tasks without a given dimension simply expand over the ones they have.
 * Cost fields are pre-filled from the best-matching existing rule; unmatched
 * combos stay blank for the admin to fill.
 *
 * Membership level is intentionally NOT crossed here — expanded rows are 通用
 * (all levels) unless later narrowed.
 */
export function expandPricingMatrix(input: {
  taskType: string;
  models: PricingMatrixModel[];
  dims?: PricingMatrixDims;
  existingRules?: PricingRuleLike[];
  spec?: PricingTaskSpec;
}): PricingRuleRow[] {
  const spec = input.spec ?? resolvePricingTaskSpec(input.taskType);
  if (!spec) {
    throw new Error(`Unknown pricing taskType: ${input.taskType}`);
  }
  const qualities = input.dims?.qualities?.length ? input.dims.qualities : [undefined];
  const resolutions = input.dims?.resolutions?.length ? input.dims.resolutions : [undefined];
  const modelTiers = input.dims?.modelTiers?.length ? input.dims.modelTiers : [undefined];

  const existingRows = (input.existingRules ?? []).map(ruleToRow);
  const rows: PricingRuleRow[] = [];

  for (const model of input.models) {
    const modelKey = buildPricingModelKey(model.provider, model.modelName);
    if (!modelKey) continue;
    for (const quality of qualities) {
      for (const resolution of resolutions) {
        for (const tier of modelTiers) {
          const combo = { modelKey, quality, resolution, tier };
          let best: PricingRuleRow | null = null;
          let bestScore = -1;
          for (const rule of existingRows) {
            const score = matchScore(rule, combo);
            if (score > bestScore) {
              bestScore = score;
              best = rule;
            }
          }
          const base = best ?? emptyRow(spec.taskType, spec.baseUnit);
          rows.push({
            ...base,
            taskType: spec.taskType,
            baseUnit: spec.baseUnit,
            name: comboName(model.modelName, [quality, resolution, tier]),
            priority: 0,
            isActive: true,
            modelKeys: [modelKey],
            qualities: quality ? [quality] : [],
            resolutions: resolution ? [resolution] : [],
            modelTiers: tier ? [tier] : [],
            membershipLevels: [],
            requireVideoInput: false,
            requireAudioInput: false,
            requirePriority: false,
            minDurationSeconds: null,
            maxDurationSeconds: null,
            extraConditions: null,
          });
        }
      }
    }
  }

  return rows;
}

// ---------------------------------------------------------------------------
// pricingScopeKey — canonical identity of a rule's SCOPE (conditions), used to
// decide "is this the same rule?" on import so equal-scope rows overwrite in
// place instead of creating duplicates. Order-independent.
// ---------------------------------------------------------------------------

export function pricingScopeKey(row: PricingRuleRow): string {
  const sorted = (arr: string[]) => [...arr].sort();
  return JSON.stringify({
    m: sorted(row.modelKeys),
    q: sorted(row.qualities),
    r: sorted(row.resolutions),
    t: sorted(row.modelTiers),
    l: sorted(row.membershipLevels),
    v: row.requireVideoInput,
    a: row.requireAudioInput,
    p: row.requirePriority,
    min: row.minDurationSeconds,
    max: row.maxDurationSeconds,
  });
}
