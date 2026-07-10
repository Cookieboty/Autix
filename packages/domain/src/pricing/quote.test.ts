import { describe, expect, it } from 'vitest';
import { quoteTask, quoteTaskFromSnapshot } from './quote';
import type { PricingSnapshot } from './quote';
import { MODEL_PRESETS, TASK_PRESETS } from './presets';
import { applyParamDefaults } from './apply-param-defaults';
import type { PricingSchema } from './types';

const modelSchema: PricingSchema = {
  terms: [
    { id: 'base', op: 'add', const: 1 },
    { id: 'quality', op: 'mul', table: { param: 'quality', values: { low: 15, medium: 90, high: 350 } } },
  ],
};

const taskFixedSchema: PricingSchema = {
  terms: [
    { id: 'taskBase', op: 'add', const: 0 },
    { id: 'toolCalls', op: 'add', perUnit: { param: 'toolCalls', unitCost: 1 } },
  ],
};

describe('quoteTask', () => {
  it('applies multiplier and discount to the model side', () => {
    const result = quoteTask({
      modelSchema, multiplier: 2, discountFactor: 0.5, params: { quality: 'medium' },
    });
    expect(result.modelSubtotalRaw).toBe(90);
    expect(result.total).toBe(90);
  });

  it('does not round the model subtotal before applying multiplier and discount', () => {
    // 模型侧求值得 7.5（1 × 15 × 0.5）。折扣 0.9：
    //   正确（末端一次 ceil）： ceil(7.5 * 0.9) = ceil(6.75) = 7
    //   错误（先 ceil 再乘）： ceil(ceil(7.5) * 0.9) = ceil(7.2) = 8
    const fractional: PricingSchema = {
      terms: [
        { id: 'base', op: 'add', const: 1 },
        { id: 'quality', op: 'mul', table: { param: 'quality', values: { low: 15 } } },
        { id: 'half', op: 'mul', const: 0.5 },
      ],
    };
    expect(quoteTask({ modelSchema: fractional, multiplier: 1, discountFactor: 0.9, params: { quality: 'low' } }).total)
      .toBe(7);
  });

  it('returns an integer total even when taskFixedCost is fractional', () => {
    // point_holds.estimatedAmount 是 Int，assertConfirmAmount 拒绝小数。
    // 模型侧 90 × 0.5 = 45，任务侧 3 × 0.5 = 1.5 -> ceil(45 + 1.5) = 47
    const fractionalFixed: PricingSchema = {
      terms: [
        { id: 'taskBase', op: 'add', const: 0 },
        { id: 'toolCalls', op: 'add', perUnit: { param: 'toolCalls', unitCost: 0.5 } },
      ],
    };
    const result = quoteTask({
      modelSchema, multiplier: 1, discountFactor: 0.5,
      taskFixedSchema: fractionalFixed, params: { quality: 'medium' }, usage: { toolCalls: 3 },
    });
    expect(result.taskFixedCostRaw).toBe(1.5);
    expect(result.total).toBe(47);
    expect(Number.isInteger(result.total)).toBe(true);
  });

  it('keeps taskFixedCost out of the discount multiplication', () => {
    const result = quoteTask({
      modelSchema, multiplier: 1, discountFactor: 0.5,
      taskFixedSchema, params: { quality: 'medium' }, usage: { toolCalls: 3 },
    });
    expect(result.modelSubtotalRaw).toBe(45); // 90 * 1 * 0.5
    expect(result.taskFixedCostRaw).toBe(3);  // 不吃 0.5 折扣
    expect(result.total).toBe(48);            // ceil(45 + 3)
  });

  it('treats a missing taskFixedSchema as zero', () => {
    const result = quoteTask({ modelSchema, multiplier: 1, discountFactor: 1, params: { quality: 'low' } });
    expect(result.taskFixedCostRaw).toBe(0);
    expect(result.total).toBe(15);
  });

  it('does not let usage affect the model subtotal', () => {
    const a = quoteTask({ modelSchema, multiplier: 1, discountFactor: 1, params: { quality: 'high' }, usage: {} });
    const b = quoteTask({
      modelSchema, multiplier: 1, discountFactor: 1, params: { quality: 'high' },
      taskFixedSchema, usage: { toolCalls: 99 },
    });
    expect(a.modelSubtotalRaw).toBe(b.modelSubtotalRaw);
  });

  it('concatenates model and task breakdowns', () => {
    const result = quoteTask({
      modelSchema, multiplier: 1, discountFactor: 1, taskFixedSchema,
      params: { quality: 'low' }, usage: { toolCalls: 2 },
    });
    expect(result.breakdown.map((b) => b.id)).toEqual(['base', 'quality', 'taskBase', 'toolCalls']);
  });
});

describe('quoteTaskFromSnapshot', () => {
  const snapshot = {
    schemaVersion: 1,
    modelConfigId: 'cfg_1',
    modelSchema,
    taskFixedSchema: null,
    multiplier: 1,
    discountFactor: 1,
    discountCode: null,
    params: { quality: 'medium' },
  };

  it('prices from the frozen schema, not from any live schema', () => {
    expect(quoteTaskFromSnapshot(snapshot, {}).total).toBe(90);
  });

  it('ignores a later price change to the live schema', () => {
    // 模拟管理员把 medium 从 90 改到 500：快照里的 schema 是值拷贝，不受影响。
    const liveSchema: PricingSchema = {
      terms: [
        { id: 'base', op: 'add', const: 1 },
        { id: 'quality', op: 'mul', table: { param: 'quality', values: { medium: 500 } } },
      ],
    };
    expect(quoteTask({ modelSchema: liveSchema, multiplier: 1, discountFactor: 1, params: { quality: 'medium' } }).total)
      .toBe(500);
    expect(quoteTaskFromSnapshot(snapshot, {}).total).toBe(90);
  });

  it('uses real usage against the frozen taskFixedSchema', () => {
    const withFixed = { ...snapshot, taskFixedSchema };
    expect(quoteTaskFromSnapshot(withFixed, { toolCalls: 4 }).total).toBe(94);
  });

  it('rejects a usage key that the frozen params already supply — settlement cannot cheapen an order', () => {
    // params 来自快照，usage 不能覆盖它——否则结算时用户可以把 quality 从
    // medium 篡改成 high（或反过来cheapen）。相交即拒绝，而不是静默采纳。
    expect(() => quoteTaskFromSnapshot(snapshot, { quality: 'high' })).toThrow(/quality/);
  });
});

describe('quoteTask — model-side merges params and usage (spec §3.1.1.65)', () => {
  it('feeds usage into the model-side evaluation, not just the task-fixed side', () => {
    const modelSchemaWithUsageTerm: PricingSchema = {
      terms: [
        { id: 'base', op: 'add', const: 0 },
        { id: 'inputTokens', op: 'add', perUnit: { param: 'inputTokens', unitCost: 1, divisor: 1000 } },
      ],
    };
    const result = quoteTask({
      modelSchema: modelSchemaWithUsageTerm,
      multiplier: 1,
      discountFactor: 1,
      params: {},
      usage: { inputTokens: 2000 },
    });
    expect(result.modelSubtotalRaw).toBe(2);
    expect(result.total).toBe(2);
  });

  it('throws when a usage key collides with a params key, instead of silently overwriting', () => {
    expect(() =>
      quoteTask({
        modelSchema,
        multiplier: 1,
        discountFactor: 1,
        params: { quality: 'medium' },
        usage: { quality: 'high' },
      }),
    ).toThrow(/quality/);
  });

  it('the collision throw message names the offending key(s)', () => {
    expect(() =>
      quoteTask({
        modelSchema,
        multiplier: 1,
        discountFactor: 1,
        params: { quality: 'medium', extra: 1 },
        usage: { quality: 'high', extra: 2 },
      }),
    ).toThrow(/quality/);
  });

  it('does not throw when params and usage keys are disjoint', () => {
    expect(() =>
      quoteTask({
        modelSchema,
        multiplier: 1,
        discountFactor: 1,
        params: { quality: 'medium' },
        usage: { toolCalls: 5 },
      }),
    ).not.toThrow();
  });
});

describe('end-to-end anchor: settlement prices real tokens, not the frozen estimate (spec §3.1.1.65 bug)', () => {
  it('prices ceil(2000*1/1000 + 1000*5/1000) + taskFixedCost from real settlement usage, not the frozen 0 estimate', () => {
    const text = MODEL_PRESETS.text;
    const chatStandard = TASK_PRESETS.find((t) => t.taskType === 'chat_message_standard');
    if (!chatStandard) throw new Error('fixture missing: chat_message_standard');

    // Estimate time: caller has no real token counts yet, so applyParamDefaults
    // fills the params-source defaults only. inputTokens/outputTokens must NOT be
    // among them (valueSource: 'usage') — they must not enter the frozen snapshot.
    const estimateParams = applyParamDefaults(text.paramsSchema, {});
    expect('inputTokens' in estimateParams).toBe(false);
    expect('outputTokens' in estimateParams).toBe(false);

    const snapshot: PricingSnapshot = {
      schemaVersion: 1,
      modelConfigId: 'model-1',
      modelSchema: text.pricingSchema,
      taskFixedSchema: chatStandard.fixedCostSchema,
      multiplier: 1,
      discountFactor: 1,
      discountCode: null,
      params: estimateParams,
    };

    // Settlement: real usage arrives, distinct from anything in params.
    const result = quoteTaskFromSnapshot(snapshot, { inputTokens: 2000, outputTokens: 1000 });

    // model side: 2000*1/1000 + 1000*5/1000 = 2 + 5 = 7 (exact)
    // task side: chat_message_standard fixed fee = 3
    // total = ceil(7 + 3) = 10, NOT 0.
    expect(result.total).toBe(10);
    expect(result.total).not.toBe(0);
  });
});
