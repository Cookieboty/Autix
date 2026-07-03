import type { PricingRuleRow } from '@autix/domain/billing';
import {
  rowToRecord,
  recordToRow,
  parseRecordsToRows,
  isBlankRecord,
  type PricingExcelRecord,
} from './pricing-excel-mapping';

function imageRow(overrides: Partial<PricingRuleRow> = {}): PricingRuleRow {
  return {
    taskType: 'image_generation',
    name: 'Seedream · 1080p',
    baseUnit: 'image',
    priority: 10,
    isActive: true,
    modelKeys: ['["seedance","seedream-4"]', '["openai","gpt-4o"]'],
    modelTiers: [],
    qualities: ['hd'],
    resolutions: [],
    membershipLevels: ['1', '2'],
    requireVideoInput: false,
    requireAudioInput: false,
    requirePriority: false,
    minDurationSeconds: null,
    maxDurationSeconds: null,
    extraConditions: null,
    baseCost: 90,
    fixedExtraCost: null,
    inputTokenCostPerK: null,
    outputTokenCostPerK: null,
    contextTokenCostPerK: null,
    toolCallCost: null,
    mcpCallCost: null,
    skillCallCost: null,
    batchUnitCost: null,
    referenceImageFixedCost: 5,
    reasoningMultiplier: null,
    referenceImageMultiplier: 1.5,
    videoInputMultiplier: null,
    audioInputMultiplier: null,
    priorityMultiplier: null,
    ...overrides,
  };
}

function validRecord(overrides: Partial<PricingExcelRecord> = {}): PricingExcelRecord {
  return { ...rowToRecord(imageRow()), ...overrides };
}

describe('rowToRecord / recordToRow round-trip', () => {
  it('preserves scope, models (multi), and costs', () => {
    const row = imageRow();
    const back = recordToRow(rowToRecord(row));
    expect(back.taskType).toBe('image_generation');
    expect(back.name).toBe('Seedream · 1080p');
    expect(back.modelKeys).toEqual(['["seedance","seedream-4"]', '["openai","gpt-4o"]']);
    expect(back.qualities).toEqual(['hd']);
    expect(back.membershipLevels).toEqual(['1', '2']);
    expect(back.baseCost).toBe(90);
    expect(back.referenceImageFixedCost).toBe(5);
    expect(back.referenceImageMultiplier).toBe(1.5);
    expect(back.priority).toBe(10);
    expect(back.isActive).toBe(true);
  });

  it('zips provider/modelName into separate ;-joined cells', () => {
    const record = rowToRecord(imageRow());
    expect(record.provider).toBe('seedance;openai');
    expect(record.modelName).toBe('seedream-4;gpt-4o');
  });
});

describe('parseRecordsToRows validation', () => {
  it('accepts a valid sheet', () => {
    const { rows, errors } = parseRecordsToRows([validRecord()], 'image_generation');
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
  });

  it('rejects rows whose taskType differs from the endpoint taskType', () => {
    const { rows, errors } = parseRecordsToRows(
      [validRecord({ taskType: 'video_generation' })],
      'image_generation',
    );
    expect(rows).toHaveLength(0);
    expect(errors[0].reason).toMatch(/不一致/);
  });

  it('rejects duplicate (taskType, name) within the file', () => {
    const { errors } = parseRecordsToRows([validRecord(), validRecord()], 'image_generation');
    expect(errors.some((e) => /重复/.test(e.reason))).toBe(true);
  });

  it('rejects non-numeric numeric cells', () => {
    const { errors } = parseRecordsToRows(
      [validRecord({ baseCost: 'abc' })],
      'image_generation',
    );
    expect(errors.some((e) => /baseCost/.test(e.reason))).toBe(true);
  });

  it('rejects mismatched provider/modelName counts', () => {
    const { errors } = parseRecordsToRows(
      [validRecord({ provider: 'seedance;openai', modelName: 'seedream-4' })],
      'image_generation',
    );
    expect(errors.some((e) => /数量不一致/.test(e.reason))).toBe(true);
  });

  it('requires a name', () => {
    const { errors } = parseRecordsToRows([validRecord({ name: '' })], 'image_generation');
    expect(errors.some((e) => /name/.test(e.reason))).toBe(true);
  });

  it('skips fully blank rows', () => {
    const blank: PricingExcelRecord = {};
    expect(isBlankRecord(blank)).toBe(true);
    const { rows, errors } = parseRecordsToRows([blank, validRecord()], 'image_generation');
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
  });

  it('reports the correct 1-based spreadsheet row number', () => {
    const { errors } = parseRecordsToRows(
      [validRecord(), validRecord({ name: '' })],
      'image_generation',
    );
    // second record is spreadsheet row 3 (header = row 1)
    expect(errors[0].row).toBe(3);
  });
});
