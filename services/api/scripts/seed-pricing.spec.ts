import { describe, it, expect } from 'vitest';
import { validateParamsSchema, validatePricingSchema } from '@autix/domain/pricing';
import { SEED_MODELS, IMAGE_MODEL_CONFIGS } from './seed-pricing.models';

const IMAGE_ROWS = SEED_MODELS.filter((row) => row.capabilities.includes('image'));

describe('SEED_MODELS — 图片模型', () => {
  it('每个图片模型都带协议三件套（protocolKey / operations / limits）——按 DB 现状写全量', () => {
    // 旧口径「image metadata 留空、由 admin 填」已废弃：seed 现在按 DB 写全量 metadata +
    // 经 IMAGE_MODEL_CONFIGS 写 per-model schema，让 fresh 安装的本地库与线上一致。
    for (const row of IMAGE_ROWS) {
      const meta = row.metadata as Record<string, unknown>;
      expect(typeof meta.protocolKey).toBe('string');
      expect(Array.isArray(meta.operations)).toBe(true);
      expect(meta.limits).toBeTruthy();
    }
    expect(IMAGE_ROWS.length).toBeGreaterThan(0);
  });

  it('绝不把 apiKey / baseUrl 写进 metadata（防凭据进 git）', () => {
    for (const row of IMAGE_ROWS) {
      const meta = row.metadata as Record<string, unknown>;
      expect('apiKey' in meta).toBe(false);
      expect('baseUrl' in meta).toBe(false);
    }
  });

  it('SEED_MODELS 图片行 ↔ IMAGE_MODEL_CONFIGS 一一对应（无遗漏 / 无孤儿）', () => {
    const rowIds = IMAGE_ROWS.map((r) => r.model).sort();
    const cfgIds = Object.keys(IMAGE_MODEL_CONFIGS).sort();
    expect(cfgIds).toEqual(rowIds);
  });

  it('每个图片模型的 paramsSchema / pricingSchema 通过域校验器（避免 EMPTY_TERMS 等免费生成陷阱）', () => {
    for (const row of IMAGE_ROWS) {
      const cfg = IMAGE_MODEL_CONFIGS[row.model];
      expect(cfg, `missing IMAGE_MODEL_CONFIGS for ${row.model}`).toBeTruthy();
      const violations = [
        ...validatePricingSchema(cfg.pricingSchema),
        ...validateParamsSchema(cfg.paramsSchema, cfg.pricingSchema),
      ];
      expect(violations, `${row.model}: ${violations.map((v) => v.code).join(',')}`).toEqual([]);
    }
  });

  it('referenceImages 恒为 role=pricing 且带 uploadMax（上游要的是图本身、不是「几张」这个数）', () => {
    for (const row of IMAGE_ROWS) {
      const props = (IMAGE_MODEL_CONFIGS[row.model].paramsSchema as { properties?: Record<string, { 'x-ui'?: { role?: string; uploadMax?: number } }> }).properties;
      const ref = props?.referenceImages;
      expect(ref?.['x-ui']?.role).toBe('pricing');
      expect(typeof ref?.['x-ui']?.uploadMax).toBe('number');
    }
  });

  it('模型 id 唯一（seedModels 以 model-id 去重，重复会让第二行永远建不出来）', () => {
    const ids = SEED_MODELS.map((row) => row.model);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
