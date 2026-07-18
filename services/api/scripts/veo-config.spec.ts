import { VIDEO_MODEL_CONFIGS } from './seed-pricing.models';
import {
  quoteTask,
  validateParams,
  validateParamsSchema,
  validatePricingSchema,
} from '@autix/domain/pricing';

const price = (
  model: keyof typeof VIDEO_MODEL_CONFIGS | string,
  params: Record<string, unknown>,
) =>
  quoteTask({
    modelSchema: VIDEO_MODEL_CONFIGS[model].pricingSchema,
    multiplier: 1,
    discountFactor: 1,
    params,
  }).total;

describe('VIDEO_MODEL_CONFIGS — 结构 & ajv', () => {
  it('每个 VEO 模型的 pricing/params schema 通过保存期校验与跨引用完整性', () => {
    for (const [model, cfg] of Object.entries(VIDEO_MODEL_CONFIGS)) {
      expect(validatePricingSchema(cfg.pricingSchema), model).toEqual([]);
      expect(validateParamsSchema(cfg.paramsSchema, cfg.pricingSchema), model).toEqual([]);
    }
  });

  it('每个 VEO 默认参数满足自身 paramsSchema（真正编译进 ajv）', () => {
    for (const [model, cfg] of Object.entries(VIDEO_MODEL_CONFIGS)) {
      const defaults = Object.fromEntries(
        Object.entries(cfg.paramsSchema.properties)
          .filter(([, p]) => p.default !== undefined)
          .map(([name, p]) => [name, p.default]),
      );
      expect(validateParams(cfg.paramsSchema, defaults), model).toEqual([]);
    }
  });
});

describe('VEO 计价 golden（每秒单价 = 美元×500，按 分辨率×是否出声 切换）', () => {
  it('fast：720p/1080p 无声 25/s、有声 37.5/s；4K 无声 75/s、有声 87.5/s', () => {
    const m = 'veo3.1-fast-official';
    expect(price(m, { resolution: '720p', duration: 8, generate_audio: false })).toBe(200); // 25×8
    expect(price(m, { resolution: '720p', duration: 8, generate_audio: true })).toBe(300); // 37.5×8
    expect(price(m, { resolution: '1080p', duration: 6, generate_audio: true })).toBe(225); // 37.5×6
    expect(price(m, { resolution: '4k', duration: 6, generate_audio: false })).toBe(450); // 75×6
    expect(price(m, { resolution: '4k', duration: 8, generate_audio: true })).toBe(700); // 87.5×8
  });

  it('lite：720p 无声 9/有声 15；1080p 无声 15/有声 24（无 4K）', () => {
    const m = 'veo3.1-lite-official';
    expect(price(m, { resolution: '720p', duration: 4, generate_audio: false })).toBe(36); // 9×4
    expect(price(m, { resolution: '720p', duration: 8, generate_audio: true })).toBe(120); // 15×8
    expect(price(m, { resolution: '1080p', duration: 8, generate_audio: false })).toBe(120); // 15×8
    expect(price(m, { resolution: '1080p', duration: 8, generate_audio: true })).toBe(192); // 24×8
  });

  it('quality：720p/1080p 无声 60/有声 120；4K 无声 120/有声 180', () => {
    const m = 'veo3.1-quality-official';
    expect(price(m, { resolution: '720p', duration: 4, generate_audio: false })).toBe(240); // 60×4
    expect(price(m, { resolution: '1080p', duration: 8, generate_audio: true })).toBe(960); // 120×8
    expect(price(m, { resolution: '4k', duration: 8, generate_audio: true })).toBe(1440); // 180×8
  });

  it('未传 generate_audio（undefined）按无声计价（ne true 命中）', () => {
    expect(price('veo3.1-fast-official', { resolution: '720p', duration: 8 })).toBe(200); // 25×8, 不是 300
  });
});

describe('Wan 2.7 计价 golden（所有模型同价：720p 30/s、1080p 45/s，仅 分辨率×时长）', () => {
  it('四个模型都是 720p=30/s、1080p=45/s', () => {
    for (const m of ['wan2.7-text-to-video', 'wan2.7-image-to-video', 'wan2.7-reference-to-video', 'wan2.7-edit-video']) {
      expect(price(m, { resolution: '720p', duration: 5 }), m).toBe(150); // 30×5
      expect(price(m, { resolution: '1080p', duration: 10 }), m).toBe(450); // 45×10
    }
  });
});

describe('Grok 计价 golden', () => {
  it('grok-imagine 按整段：6s=75、10s=100（不随分辨率）', () => {
    expect(price('grok-imagine', { duration: 6 })).toBe(75);
    expect(price('grok-imagine', { duration: 10 })).toBe(100);
  });
  it('grok-imagine-video-1.5：每秒×分辨率 + 输入图 5', () => {
    expect(price('grok-imagine-video-1.5', { resolution: '720p', duration: 6 })).toBe(380); // 62.5×6+5
    expect(price('grok-imagine-video-1.5', { resolution: '480p', duration: 10 })).toBe(365); // 36×10+5
  });
});

describe('Happy Horse 计价 golden（分辨率×时长）', () => {
  it('happy-horse：720p 40/s、1080p 80/s', () => {
    expect(price('happy-horse', { resolution: '720p', duration: 5 })).toBe(200); // 40×5
    expect(price('happy-horse', { resolution: '1080p', duration: 10 })).toBe(800); // 80×10
  });
  it('happy-horse-1.1：720p 55/s、1080p 70/s', () => {
    expect(price('happy-horse-1.1', { resolution: '720p', duration: 5 })).toBe(275); // 55×5
    expect(price('happy-horse-1.1', { resolution: '1080p', duration: 10 })).toBe(700); // 70×10
  });
});
