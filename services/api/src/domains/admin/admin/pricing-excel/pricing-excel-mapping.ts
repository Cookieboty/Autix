/**
 * Pure (no exceljs / no Nest) mapping between a spreadsheet cell record and a
 * domain `PricingRuleRow`, plus import-time validation.
 *
 * Kept separate from the exceljs I/O so the row<->record transform and the
 * validation rules can be unit-tested without touching real workbooks.
 */
import {
  buildPricingModelKey,
  parsePricingModelKey,
  pricingScopeKey,
  resolvePricingTaskSpec,
  type PricingRuleRow,
} from '@autix/domain/billing';

/** A single spreadsheet row as a map of columnKey -> raw cell value. */
export type PricingExcelRecord = Record<string, string | number | boolean | null | undefined>;

export interface PricingExcelColumn {
  key: string;
  header: string;
}

/** Ordered column definitions — drives both the generated header and parsing. */
export const PRICING_EXCEL_COLUMNS: PricingExcelColumn[] = [
  { key: 'taskType', header: 'taskType' },
  { key: 'name', header: 'name（唯一标识/勿改）' },
  { key: 'baseUnit', header: 'baseUnit' },
  { key: 'priority', header: 'priority' },
  { key: 'isActive', header: 'isActive' },
  { key: 'provider', header: 'provider（多个;分隔）' },
  { key: 'modelName', header: 'modelName（多个;分隔）' },
  { key: 'modelTier', header: 'modelTier（多个;分隔）' },
  { key: 'quality', header: 'quality（多个;分隔）' },
  { key: 'resolution', header: 'resolution（多个;分隔）' },
  { key: 'membershipLevel', header: 'membershipLevel（多个;分隔）' },
  { key: 'minSeconds', header: 'minSeconds' },
  { key: 'maxSeconds', header: 'maxSeconds' },
  { key: 'hasVideoInput', header: 'hasVideoInput' },
  { key: 'hasAudioInput', header: 'hasAudioInput' },
  { key: 'priorityInput', header: 'priorityInput' },
  { key: 'baseCost', header: 'baseCost' },
  { key: 'fixedExtraCost', header: 'fixedExtraCost' },
  { key: 'inputTokenCostPerK', header: 'inputTokenCostPerK' },
  { key: 'outputTokenCostPerK', header: 'outputTokenCostPerK' },
  { key: 'contextTokenCostPerK', header: 'contextTokenCostPerK' },
  { key: 'toolCallCost', header: 'toolCallCost' },
  { key: 'mcpCallCost', header: 'mcpCallCost' },
  { key: 'skillCallCost', header: 'skillCallCost' },
  { key: 'batchUnitCost', header: 'batchUnitCost' },
  { key: 'referenceImageFixedCost', header: 'referenceImageFixedCost' },
  { key: 'reasoningMultiplier', header: 'reasoningMultiplier' },
  { key: 'referenceImageMultiplier', header: 'referenceImageMultiplier' },
  { key: 'videoInputMultiplier', header: 'videoInputMultiplier' },
  { key: 'audioInputMultiplier', header: 'audioInputMultiplier' },
  { key: 'priorityMultiplier', header: 'priorityMultiplier' },
];

const NUMERIC_KEYS = [
  'priority',
  'minSeconds',
  'maxSeconds',
  'baseCost',
  'fixedExtraCost',
  'inputTokenCostPerK',
  'outputTokenCostPerK',
  'contextTokenCostPerK',
  'toolCallCost',
  'mcpCallCost',
  'skillCallCost',
  'batchUnitCost',
  'referenceImageFixedCost',
  'reasoningMultiplier',
  'referenceImageMultiplier',
  'videoInputMultiplier',
  'audioInputMultiplier',
  'priorityMultiplier',
] as const;

const TRUE_TOKENS = new Set(['true', '1', 'yes', 'y', '是', 'on']);

export interface ImportRowError {
  row: number; // 1-based spreadsheet row (header is row 1)
  name?: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// cell helpers
// ---------------------------------------------------------------------------

function str(value: unknown): string {
  return String(value ?? '').trim();
}
function numOrNull(value: unknown): number | null {
  const text = str(value);
  if (!text) return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}
function boolCell(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  const text = str(value).toLowerCase();
  if (!text) return fallback;
  return TRUE_TOKENS.has(text);
}
function splitList(value: unknown): string[] {
  const text = str(value);
  if (!text) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(/[;,]/)) {
    const item = part.trim();
    if (item && !seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}
function joinList(values: string[]): string {
  return values.join(';');
}

export function isBlankRecord(record: PricingExcelRecord): boolean {
  return PRICING_EXCEL_COLUMNS.every((col) => str(record[col.key]) === '');
}

// ---------------------------------------------------------------------------
// row -> record  (export)
// ---------------------------------------------------------------------------

export function rowToRecord(row: PricingRuleRow): PricingExcelRecord {
  const parsed = row.modelKeys.map(parsePricingModelKey).filter((m): m is { provider: string; modelName: string } => m != null);
  return {
    taskType: row.taskType,
    name: row.name,
    baseUnit: row.baseUnit,
    priority: row.priority,
    isActive: row.isActive,
    provider: joinList(parsed.map((m) => m.provider)),
    modelName: joinList(parsed.map((m) => m.modelName)),
    modelTier: joinList(row.modelTiers),
    quality: joinList(row.qualities),
    resolution: joinList(row.resolutions),
    membershipLevel: joinList(row.membershipLevels),
    minSeconds: row.minDurationSeconds,
    maxSeconds: row.maxDurationSeconds,
    hasVideoInput: row.requireVideoInput,
    hasAudioInput: row.requireAudioInput,
    priorityInput: row.requirePriority,
    baseCost: row.baseCost,
    fixedExtraCost: row.fixedExtraCost,
    inputTokenCostPerK: row.inputTokenCostPerK,
    outputTokenCostPerK: row.outputTokenCostPerK,
    contextTokenCostPerK: row.contextTokenCostPerK,
    toolCallCost: row.toolCallCost,
    mcpCallCost: row.mcpCallCost,
    skillCallCost: row.skillCallCost,
    batchUnitCost: row.batchUnitCost,
    referenceImageFixedCost: row.referenceImageFixedCost,
    reasoningMultiplier: row.reasoningMultiplier,
    referenceImageMultiplier: row.referenceImageMultiplier,
    videoInputMultiplier: row.videoInputMultiplier,
    audioInputMultiplier: row.audioInputMultiplier,
    priorityMultiplier: row.priorityMultiplier,
  };
}

// ---------------------------------------------------------------------------
// record -> row  (import)
// ---------------------------------------------------------------------------

export function recordToRow(record: PricingExcelRecord): PricingRuleRow {
  const taskType = str(record.taskType);
  const spec = resolvePricingTaskSpec(taskType);
  const providers = splitList(record.provider);
  const modelNames = splitList(record.modelName);
  const modelKeys: string[] = [];
  for (let i = 0; i < Math.max(providers.length, modelNames.length); i += 1) {
    const key = buildPricingModelKey(providers[i], modelNames[i]);
    if (key) modelKeys.push(key);
  }
  return {
    taskType,
    name: str(record.name),
    baseUnit: spec?.baseUnit ?? str(record.baseUnit) ?? 'task',
    priority: numOrNull(record.priority) ?? 0,
    isActive: boolCell(record.isActive, true),
    modelKeys,
    modelTiers: splitList(record.modelTier),
    qualities: splitList(record.quality),
    resolutions: splitList(record.resolution),
    membershipLevels: splitList(record.membershipLevel),
    requireVideoInput: boolCell(record.hasVideoInput, false),
    requireAudioInput: boolCell(record.hasAudioInput, false),
    requirePriority: boolCell(record.priorityInput, false),
    minDurationSeconds: numOrNull(record.minSeconds),
    maxDurationSeconds: numOrNull(record.maxSeconds),
    extraConditions: null,
    baseCost: numOrNull(record.baseCost),
    fixedExtraCost: numOrNull(record.fixedExtraCost),
    inputTokenCostPerK: numOrNull(record.inputTokenCostPerK),
    outputTokenCostPerK: numOrNull(record.outputTokenCostPerK),
    contextTokenCostPerK: numOrNull(record.contextTokenCostPerK),
    toolCallCost: numOrNull(record.toolCallCost),
    mcpCallCost: numOrNull(record.mcpCallCost),
    skillCallCost: numOrNull(record.skillCallCost),
    batchUnitCost: numOrNull(record.batchUnitCost),
    referenceImageFixedCost: numOrNull(record.referenceImageFixedCost),
    reasoningMultiplier: numOrNull(record.reasoningMultiplier),
    referenceImageMultiplier: numOrNull(record.referenceImageMultiplier),
    videoInputMultiplier: numOrNull(record.videoInputMultiplier),
    audioInputMultiplier: numOrNull(record.audioInputMultiplier),
    priorityMultiplier: numOrNull(record.priorityMultiplier),
  };
}

// ---------------------------------------------------------------------------
// validate + parse a whole sheet
// ---------------------------------------------------------------------------

/**
 * Turn raw cell records into validated rows.
 * - Rows are all-or-nothing at the caller: any error → reject the whole file.
 * - Enforces: taskType present + matches the endpoint's taskType + is known;
 *   name present; numeric cells numeric; provider/modelName counts aligned;
 *   no duplicate (taskType,name) within the file.
 */
export function parseRecordsToRows(
  records: PricingExcelRecord[],
  expectedTaskType: string,
): { rows: PricingRuleRow[]; errors: ImportRowError[] } {
  const rows: PricingRuleRow[] = [];
  const errors: ImportRowError[] = [];
  const seen = new Set<string>();
  const seenScope = new Set<string>();

  records.forEach((record, index) => {
    if (isBlankRecord(record)) return;
    const rowNum = index + 2; // header occupies row 1
    const taskType = str(record.taskType);
    const name = str(record.name);
    const rowErrors: string[] = [];

    if (!taskType) {
      rowErrors.push('taskType 为空');
    } else if (taskType !== expectedTaskType) {
      rowErrors.push(`taskType「${taskType}」与导入任务「${expectedTaskType}」不一致`);
    } else if (!resolvePricingTaskSpec(taskType)) {
      rowErrors.push(`未知 taskType「${taskType}」`);
    }
    if (!name) rowErrors.push('name 为空');

    for (const key of NUMERIC_KEYS) {
      const text = str(record[key]);
      if (text && !Number.isFinite(Number(text))) {
        rowErrors.push(`${key}「${text}」不是合法数字`);
      }
    }

    const providerCount = splitList(record.provider).length;
    const modelNameCount = splitList(record.modelName).length;
    if (providerCount !== modelNameCount) {
      rowErrors.push(`provider 与 modelName 数量不一致（${providerCount} vs ${modelNameCount}）`);
    }

    if (taskType && name) {
      const dedupeKey = `${taskType}::${name}`;
      if (seen.has(dedupeKey)) {
        rowErrors.push(`文件内重复的 (taskType, name)：${name}`);
      } else {
        seen.add(dedupeKey);
      }
    }

    if (rowErrors.length > 0) {
      for (const reason of rowErrors) errors.push({ row: rowNum, name: name || undefined, reason });
      return;
    }

    const row = recordToRow(record);
    // Two rows with identical scope (same model/quality/resolution/…) would both
    // target the same rule on import — reject so the outcome stays deterministic.
    const scopeKey = pricingScopeKey(row);
    if (seenScope.has(scopeKey)) {
      errors.push({ row: rowNum, name: name || undefined, reason: '作用域重复（模型/质量/分辨率与另一行相同）' });
      return;
    }
    seenScope.add(scopeKey);
    rows.push(row);
  });

  return { rows, errors };
}
