import { describe, expect, it } from 'vitest';
import { MODEL_PRESETS, TASK_PRESETS } from './presets';
import { quoteTask } from './quote';
import { validateParamsSchema, validatePricingSchema } from './validate-schema';
import { validateParams } from './validate-params';

const quote = (key: keyof typeof MODEL_PRESETS, params: Record<string, unknown>) =>
  quoteTask({
    modelSchema: MODEL_PRESETS[key].pricingSchema,
    multiplier: 1,
    discountFactor: 1,
    params,
  }).total;

describe('presets — structural validity', () => {
  it('every model preset passes save-time validation', () => {
    for (const [key, preset] of Object.entries(MODEL_PRESETS)) {
      expect(validatePricingSchema(preset.pricingSchema), key).toEqual([]);
    }
  });

  it('every model preset passes params-schema and cross-schema validation', () => {
    for (const [key, preset] of Object.entries(MODEL_PRESETS)) {
      // 第二个参数触发跨 schema 引用完整性校验：pricingSchema 引用的每个参数
      // 必须存在于 paramsSchema.properties。这是 preset 里最容易出的错——
      // 写了 table: { param: 'style' } 却忘了在 paramsSchema 里声明 style，
      // 该 term 会被静默跳过，价格不变，没有任何报错。
      expect(validateParamsSchema(preset.paramsSchema, preset.pricingSchema), key).toEqual([]);
    }
  });

  it('every task fixedCostSchema (where present) passes save-time validation', () => {
    for (const task of TASK_PRESETS) {
      if (!task.fixedCostSchema) continue;
      expect(validatePricingSchema(task.fixedCostSchema), task.taskType).toEqual([]);
    }
  });

  it('every model preset default params satisfy its own paramsSchema', () => {
    for (const [key, preset] of Object.entries(MODEL_PRESETS)) {
      const defaults = Object.fromEntries(
        Object.entries(preset.paramsSchema.properties)
          .filter(([, p]) => p.default !== undefined)
          .map(([name, p]) => [name, p.default]),
      );
      // 这一步把 schema 真正编译进 ajv（strict 模式）。这是唯一能抓住
      // 「allOf[].then.properties.<x> 忘了自带 type」这类错误的断言——
      // validatePricingSchema / validateParamsSchema 都不跑 ajv。
      expect(validateParams(preset.paramsSchema, defaults), key).toEqual([]);
    }
  });

  it('declares exactly the nine known task types', () => {
    expect(TASK_PRESETS.map((t) => t.taskType).sort()).toEqual([
      'chat_message_fast',
      'chat_message_reasoning',
      'chat_message_standard',
      'image_generation',
      'prompt_optimize_generation',
      'prompt_optimize_pro',
      'video_generation',
      'video_storyboard_optimize',
      'video_template_optimize',
    ]);
  });

  it('marks exactly chat_message_fast and chat_message_reasoning as inactive', () => {
    // spec §3.1.1.7：没有 fast / reasoning 档模型可绑，这两个任务必须 isActive=false，
    // 其余 7 个任务都有 text/image/video 模型可绑，isActive=true。
    const inactive = TASK_PRESETS.filter((t) => !t.isActive).map((t) => t.taskType).sort();
    expect(inactive).toEqual(['chat_message_fast', 'chat_message_reasoning']);
    expect(TASK_PRESETS.filter((t) => t.isActive)).toHaveLength(7);
  });

  it('binds every task to at least one model preset that exists', () => {
    for (const task of TASK_PRESETS) {
      expect(task.modelPresets.length, task.taskType).toBeGreaterThan(0);
      for (const key of task.modelPresets) {
        expect(MODEL_PRESETS[key], `${task.taskType} -> ${key}`).toBeDefined();
      }
    }
  });
});

describe('presets — golden prices (text)', () => {
  it('prices zero tokens at zero — there is no per-message base fee anymore', () => {
    // base(0) + inputTokens(0*1/1000=0) + outputTokens(0*5/1000=0) = 0
    expect(quote('text', { inputTokens: 0, outputTokens: 0 })).toBe(0);
  });

  it('prices 2000 in / 1000 out at 1/1000 and 5/1000 per-token rates', () => {
    // base 0 + 2000*1/1000 (=2) + 1000*5/1000 (=5) = 0 + 2 + 5 = 7
    expect(quote('text', { inputTokens: 2000, outputTokens: 1000 })).toBe(7);
  });

  it('rounds a genuinely fractional subtotal up exactly once', () => {
    // inputTokens: 100*1/1000 = 0.1
    // outputTokens: 100*5/1000 = 0.5
    // subtotal = 0 + 0.1 + 0.5 = 0.6, which is not an integer going into the
    // single terminal ceil() in quoteTask — ceil(0.6) = 1.
    expect(quote('text', { inputTokens: 100, outputTokens: 100 })).toBe(1);
  });
});

describe('presets — golden prices (image, single-image; quantity removed)', () => {
  it('prices quality tiers at 1K for a single image with no references', () => {
    const at = (quality: string) => quote('image', { quality, resolution: '1K', referenceImages: 0 });
    expect(at('low')).toBe(15);
    expect(at('medium')).toBe(90);
    expect(at('high')).toBe(350);
  });

  it('scales by resolution multiplier', () => {
    const at = (resolution: string) =>
      quote('image', { quality: 'medium', resolution, referenceImages: 0 });
    expect(at('512px')).toBe(45);
    expect(at('1K')).toBe(90);
    expect(at('2K')).toBe(180);
    expect(at('4K')).toBe(360);
  });

  it('rounds a fractional subtotal up exactly once', () => {
    // low(15) * 512px(0.5) = 7.5 -> ceil 8
    expect(quote('image', { quality: 'low', resolution: '512px', referenceImages: 0 })).toBe(8);
  });

  it('adds reference images on top of the single-image price (quantity no longer multiplies)', () => {
    // 生成张数已从图像计价移除：schema 只算一张。90(单张) + 5*1(参考图) = 95。
    expect(quote('image', { quality: 'medium', resolution: '1K', referenceImages: 1 })).toBe(95);
  });

  it('charges 5 per reference image, unscaled by resolution', () => {
    // (1 * 90 * 4) = 360, + 5*3 = 375
    expect(quote('image', { quality: 'medium', resolution: '4K', referenceImages: 3 })).toBe(375);
  });
});

describe('presets — golden prices (video, unchanged)', () => {
  it('prices per second by resolution', () => {
    const at = (resolution: string, seconds: number) => quote('video', { resolution, seconds });
    expect(at('480p', 5)).toBe(800);
    expect(at('720p', 5)).toBe(1600);
    expect(at('1080p', 5)).toBe(4000);
    expect(at('4k', 5)).toBe(8000);
  });

  it('scales linearly with duration', () => {
    expect(quote('video', { resolution: '720p', seconds: 10 })).toBe(3200);
  });
});

describe('presets — full chain: model tokens + task fixed fee', () => {
  const chatStandard = TASK_PRESETS.find((t) => t.taskType === 'chat_message_standard');
  if (!chatStandard) throw new Error('fixture missing: chat_message_standard');

  it('adds the task fixed fee on top of the model token price, undiscounted', () => {
    // model side: base 0 + 2000*1/1000 (=2) + 1000*5/1000 (=5) = 7 (exact, no rounding yet)
    // task side: taskBase const 3 (chat_message_standard, see ensure-pricing-rules.ts base:3)
    // quoteTask total = ceil(modelSubtotalRaw + taskFixedRaw) = ceil(7*1*1 + 3) = ceil(10) = 10
    const result = quoteTask({
      modelSchema: MODEL_PRESETS.text.pricingSchema,
      multiplier: 1,
      discountFactor: 1,
      taskFixedSchema: chatStandard.fixedCostSchema,
      params: { inputTokens: 2000, outputTokens: 1000 },
      usage: {},
    });
    expect(result.total).toBe(10);
  });

  it('discounts the model subtotal but not the task fixed fee', () => {
    // model side raw (undiscounted) total is still 7, per evaluatePricing.
    // modelSubtotalRaw = 7 * multiplier(1) * discountFactor(0.5) = 3.5
    // taskFixedCostRaw = 3 (unaffected by discountFactor — it's added outside the multiply)
    // quoteTask applies exactly one ceil, over the *sum*: ceil(3.5 + 3) = ceil(6.5) = 7
    //
    // Note: this happens to equal ceil(7*0.5) + 3 = 4 + 3 = 7 as well, but that is a
    // coincidence of these particular numbers — quoteTask only ceils once, at the end,
    // not once on the model subtotal and again on the grand total.
    const result = quoteTask({
      modelSchema: MODEL_PRESETS.text.pricingSchema,
      multiplier: 1,
      discountFactor: 0.5,
      taskFixedSchema: chatStandard.fixedCostSchema,
      params: { inputTokens: 2000, outputTokens: 1000 },
      usage: {},
    });
    expect(result.modelSubtotalRaw).toBe(3.5);
    expect(result.taskFixedCostRaw).toBe(3);
    expect(result.total).toBe(7);
  });
});

describe('前端本地计价的前置不变量', () => {
  // ImageComposer 本地估算硬编码 taskFixedSchema: null（前端拿不到任务级固定费结构，
  // 那是故意不下发的）。这只在 image_generation 无固定费时成立。若将来给图片加了固定费，
  // 这个断言会红，强制回来处理 taskFixedSchema 的下发，而不是静默把固定费漏算。
  it('image_generation 无任务级固定费（前端 taskFixedSchema=null 的依据）', () => {
    const image = TASK_PRESETS.find((t) => t.taskType === 'image_generation');
    expect(image).toBeDefined();
    expect(image?.fixedCostSchema).toBeNull();
  });
});
