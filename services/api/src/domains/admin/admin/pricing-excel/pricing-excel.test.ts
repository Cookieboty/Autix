import type { PricingRuleRow } from '@autix/domain/billing';
import { buildPricingWorkbookBuffer, parsePricingWorkbook } from './pricing-excel';
import { parseRecordsToRows } from './pricing-excel-mapping';

function imageRow(): PricingRuleRow {
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
  };
}

describe('exceljs workbook round-trip', () => {
  it('builds an xlsx buffer and parses it back to equivalent rows', async () => {
    const buffer = await buildPricingWorkbookBuffer([imageRow()], 'image_generation');
    expect(buffer.length).toBeGreaterThan(0);

    const records = await parsePricingWorkbook(buffer);
    const { rows, errors } = parseRecordsToRows(records, 'image_generation');

    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row.name).toBe('Seedream · 1080p');
    expect(row.modelKeys).toEqual(['["seedance","seedream-4"]', '["openai","gpt-4o"]']);
    expect(row.qualities).toEqual(['hd']);
    expect(row.membershipLevels).toEqual(['1', '2']);
    expect(row.baseCost).toBe(90);
    expect(row.referenceImageFixedCost).toBe(5);
    expect(row.referenceImageMultiplier).toBe(1.5);
  });

  it('does not surface the hidden _meta sheet as data rows', async () => {
    const buffer = await buildPricingWorkbookBuffer([imageRow()], 'image_generation');
    const records = await parsePricingWorkbook(buffer);
    // Only the single data row — _meta lives on a separate veryHidden sheet.
    expect(records).toHaveLength(1);
  });

  it('produces an empty record list for a rules-less export', async () => {
    const buffer = await buildPricingWorkbookBuffer([], 'image_generation');
    const records = await parsePricingWorkbook(buffer);
    expect(records).toEqual([]);
  });
});
