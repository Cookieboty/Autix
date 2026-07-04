import { describe, expect, it } from 'vitest';
import type { GenerationPricingRule } from './index';
import {
  buildPricingModelKey,
  parsePricingModelKey,
  ruleToRow,
  rowToUpsert,
  resolvePricingTaskSpec,
  expandPricingMatrix,
  pricingScopeKey,
  type PricingRuleComponentInput,
  type PricingRuleRow,
} from './pricing-rule-mapping';

/** Normalize components for order-insensitive comparison. */
function normalizeComponents(components: PricingRuleComponentInput[]) {
  return [...components]
    .map((c) => ({
      componentType: c.componentType,
      unitCost: c.unitCost ?? null,
      multiplier: c.multiplier ?? null,
    }))
    .sort((a, b) => a.componentType.localeCompare(b.componentType));
}

const imageRule: GenerationPricingRule = {
  id: 'rule_1',
  taskType: 'image_generation',
  name: 'Seedream · 1080p',
  baseUnit: 'image',
  priority: 10,
  isActive: true,
  conditions: {
    modelKey: { in: ['["seedance","seedream-4"]'] },
    quality: { in: ['hd'] },
    membershipLevel: { in: [1, 2] },
  },
  components: [
    { componentType: 'per_image', unitCost: 2, isActive: true },
    { componentType: 'per_reference_image', unitCost: 5, isActive: true },
    { componentType: 'reference_image_multiplier', multiplier: 1.5, isActive: true },
  ],
};

describe('buildPricingModelKey / parsePricingModelKey', () => {
  it('builds a JSON tuple key from provider + modelName', () => {
    expect(buildPricingModelKey('seedance', 'seedream-4')).toBe(
      JSON.stringify(['seedance', 'seedream-4']),
    );
  });

  it('returns empty string when provider or modelName is missing', () => {
    expect(buildPricingModelKey('', 'x')).toBe('');
    expect(buildPricingModelKey('x', '')).toBe('');
    expect(buildPricingModelKey(null, undefined)).toBe('');
  });

  it('round-trips through parse', () => {
    const key = buildPricingModelKey('openai', 'gpt-4o');
    expect(parsePricingModelKey(key)).toEqual({ provider: 'openai', modelName: 'gpt-4o' });
  });

  it('rejects non-tuple / legacy plain-string keys', () => {
    expect(parsePricingModelKey('gpt-4o')).toBeNull();
    expect(parsePricingModelKey('["only-one"]')).toBeNull();
  });
});

describe('ruleToRow → rowToUpsert round-trip', () => {
  it('preserves conditions and components semantically', () => {
    const row = ruleToRow(imageRule);
    const upsert = rowToUpsert(row);

    expect(upsert.taskType).toBe('image_generation');
    expect(upsert.name).toBe('Seedream · 1080p');
    expect(upsert.baseUnit).toBe('image');
    expect(upsert.priority).toBe(10);
    expect(upsert.isActive).toBe(true);

    expect(upsert.conditions).toEqual({
      modelKey: { in: ['["seedance","seedream-4"]'] },
      quality: { in: ['hd'] },
      membershipLevel: { in: [1, 2] },
    });

    expect(normalizeComponents(upsert.components)).toEqual(
      normalizeComponents([
        { componentType: 'per_image', unitCost: 2, sort: 0, isActive: true },
        { componentType: 'per_reference_image', unitCost: 5, sort: 0, isActive: true },
        { componentType: 'reference_image_multiplier', multiplier: 1.5, sort: 0, isActive: true },
      ]),
    );
  });

  it('preserves non-generated (unknown) conditions verbatim', () => {
    const rule: GenerationPricingRule = {
      ...imageRule,
      conditions: { modelKey: { in: ['["p","m"]'] }, customFlag: 'keep-me' },
    };
    const row = ruleToRow(rule);
    expect(row.extraConditions).toEqual({ customFlag: 'keep-me' });
    expect(rowToUpsert(row).conditions).toMatchObject({ customFlag: 'keep-me' });
  });
});

describe('base component resolves by baseUnit', () => {
  const baseRow = (): PricingRuleRow => ({ ...ruleToRow(imageRule), baseCost: 7 });

  it('image → per_image', () => {
    const upsert = rowToUpsert({ ...baseRow(), taskType: 'image_generation' });
    expect(upsert.components.find((c) => c.unitCost === 7)?.componentType).toBe('per_image');
  });

  it('second → per_second', () => {
    const spec = resolvePricingTaskSpec('video_generation');
    const upsert = rowToUpsert({ ...baseRow(), taskType: 'video_generation' }, { spec });
    expect(upsert.baseUnit).toBe('second');
    expect(upsert.components.find((c) => c.unitCost === 7)?.componentType).toBe('per_second');
  });

  it('other units → base', () => {
    const upsert = rowToUpsert({ ...baseRow(), taskType: 'chat_message_fast' });
    expect(upsert.baseUnit).toBe('message');
    expect(upsert.components.find((c) => c.unitCost === 7)?.componentType).toBe('base');
  });
});

describe('component skip rules', () => {
  it('drops empty (null / <=0) cost fields', () => {
    const row: PricingRuleRow = { ...ruleToRow(imageRule), baseCost: null, referenceImageFixedCost: 0 };
    const upsert = rowToUpsert(row);
    expect(upsert.components.some((c) => c.componentType === 'per_image')).toBe(false);
    expect(upsert.components.some((c) => c.componentType === 'per_reference_image')).toBe(false);
  });

  it('drops multiplier === 1 (identity)', () => {
    const row: PricingRuleRow = {
      ...ruleToRow(imageRule),
      taskType: 'chat_message_reasoning',
      reasoningMultiplier: 1,
    };
    const upsert = rowToUpsert(row);
    expect(upsert.components.some((c) => c.componentType === 'reasoning_multiplier')).toBe(false);
  });

  it('keeps multiplier !== 1', () => {
    const row: PricingRuleRow = {
      ...ruleToRow(imageRule),
      taskType: 'chat_message_reasoning',
      reasoningMultiplier: 1.2,
    };
    const upsert = rowToUpsert(row);
    expect(upsert.components.find((c) => c.componentType === 'reasoning_multiplier')?.multiplier).toBe(1.2);
  });

  it('floors integer-typed base cost', () => {
    const row: PricingRuleRow = { ...ruleToRow(imageRule), baseCost: 3.9 };
    const upsert = rowToUpsert(row);
    expect(upsert.components.find((c) => c.componentType === 'per_image')?.unitCost).toBe(3);
  });
});

describe('field gating by task spec', () => {
  it('drops cost fields not enabled for the task', () => {
    // image_generation does NOT enable token costs; they must not leak through.
    const row: PricingRuleRow = { ...ruleToRow(imageRule), inputTokenCostPerK: 9 };
    const upsert = rowToUpsert(row);
    expect(upsert.components.some((c) => c.componentType === 'input_token_per_1k')).toBe(false);
  });
});

describe('preserve untouched fields on update', () => {
  it('carries rule-level advanced fields and component config from existing', () => {
    const existing: GenerationPricingRule = {
      ...imageRule,
      refundPolicy: { type: 'partial' },
      metadata: { note: 'legacy' },
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      effectiveTo: null,
      components: [
        { componentType: 'per_image', unitCost: 2, config: { rounding: 'ceil' }, isActive: true },
      ],
    };
    const row = ruleToRow(imageRule);
    const upsert = rowToUpsert(row, { existing });

    expect(upsert.refundPolicy).toEqual({ type: 'partial' });
    expect(upsert.metadata).toEqual({ note: 'legacy' });
    expect(upsert.effectiveFrom).toBe('2026-01-01T00:00:00.000Z');
    expect(upsert.effectiveTo).toBeNull();
    expect(upsert.components.find((c) => c.componentType === 'per_image')?.config).toEqual({ rounding: 'ceil' });
  });

  it('preserves unknown (non-generated) conditions from existing on update', () => {
    const existing: GenerationPricingRule = {
      ...imageRule,
      conditions: { modelKey: { in: ['["p","m"]'] }, legacyFlag: 'keep' },
    };
    // Row rebuilt from a spreadsheet has no column for `legacyFlag`.
    const row: PricingRuleRow = { ...ruleToRow(imageRule), extraConditions: null };
    const upsert = rowToUpsert(row, { existing });
    expect(upsert.conditions).toMatchObject({ legacyFlag: 'keep' });
  });

  it('does not inject advanced fields when creating (no existing)', () => {
    const upsert = rowToUpsert(ruleToRow(imageRule));
    expect(upsert.refundPolicy).toBeUndefined();
    expect(upsert.metadata).toBeUndefined();
    expect(upsert.effectiveFrom).toBeUndefined();
  });
});

describe('unknown taskType', () => {
  it('throws when no spec can be resolved', () => {
    const row: PricingRuleRow = { ...ruleToRow(imageRule), taskType: 'not_a_task' };
    expect(() => rowToUpsert(row)).toThrow(/Unknown pricing taskType/);
  });
});

describe('expandPricingMatrix', () => {
  const models = [
    { provider: 'amux', modelName: 'gpt-image-2' },
    { provider: 'amux', modelName: 'gemini' },
  ];
  const dims = { qualities: ['medium', 'high'], resolutions: ['1K', '2K'] };

  it('flattens model × quality × resolution into one row per combo', () => {
    const rows = expandPricingMatrix({ taskType: 'image_generation', models, dims });
    expect(rows).toHaveLength(2 * 2 * 2);
    for (const row of rows) {
      expect(row.modelKeys).toHaveLength(1);
      expect(row.qualities).toHaveLength(1);
      expect(row.resolutions).toHaveLength(1);
      expect(row.membershipLevels).toEqual([]);
    }
  });

  it('pre-fills cost from the best-matching existing rule and leaves the rest blank', () => {
    const existing = [
      {
        taskType: 'image_generation',
        name: '图片模板生成',
        baseUnit: 'image',
        priority: 0,
        isActive: true,
        conditions: {
          modelKey: { in: [buildPricingModelKey('amux', 'gpt-image-2')] },
          quality: { in: ['medium'] },
        },
        components: [{ componentType: 'per_image', unitCost: 90, isActive: true }],
      },
    ];
    const rows = expandPricingMatrix({ taskType: 'image_generation', models, dims, existingRules: existing });
    const find = (model: string, quality: string, resolution: string) =>
      rows.find(
        (r) =>
          r.modelKeys[0] === buildPricingModelKey('amux', model) &&
          r.qualities[0] === quality &&
          r.resolutions[0] === resolution,
      );

    // gpt-image-2 + medium matches (rule has no resolution constraint → both resolutions).
    expect(find('gpt-image-2', 'medium', '1K')?.baseCost).toBe(90);
    expect(find('gpt-image-2', 'medium', '2K')?.baseCost).toBe(90);
    // high quality does not match the rule → blank.
    expect(find('gpt-image-2', 'high', '1K')?.baseCost).toBeNull();
    // a different model → blank.
    expect(find('gemini', 'medium', '1K')?.baseCost).toBeNull();
  });

  it('collapses missing dimensions to one row per model', () => {
    const rows = expandPricingMatrix({ taskType: 'image_generation', models });
    expect(rows).toHaveLength(2);
    expect(rows[0].qualities).toEqual([]);
    expect(rows[0].resolutions).toEqual([]);
  });

  it('throws on unknown taskType', () => {
    expect(() => expandPricingMatrix({ taskType: 'nope', models })).toThrow(/Unknown pricing taskType/);
  });
});

describe('pricingScopeKey', () => {
  const base = ruleToRow(imageRule);

  it('is order-independent for scope arrays', () => {
    const a: PricingRuleRow = { ...base, modelKeys: ['a', 'b'], qualities: ['hd', 'sd'] };
    const b: PricingRuleRow = { ...base, modelKeys: ['b', 'a'], qualities: ['sd', 'hd'] };
    expect(pricingScopeKey(a)).toBe(pricingScopeKey(b));
  });

  it('differs when scope differs', () => {
    const a: PricingRuleRow = { ...base, resolutions: ['1K'] };
    const b: PricingRuleRow = { ...base, resolutions: ['2K'] };
    expect(pricingScopeKey(a)).not.toBe(pricingScopeKey(b));
  });

  it('ignores cost fields (same scope, different price → same key)', () => {
    const cheap: PricingRuleRow = { ...base, baseCost: 1 };
    const dear: PricingRuleRow = { ...base, baseCost: 999 };
    expect(pricingScopeKey(cheap)).toBe(pricingScopeKey(dear));
  });
});
