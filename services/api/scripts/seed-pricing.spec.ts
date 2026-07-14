import { SEED_MODELS } from './seed-pricing.models';

const IMAGE_ROWS = SEED_MODELS.filter((row) => row.capabilities.includes('image'));

describe('SEED_MODELS — 图片模型', () => {
  it('只登记「有哪些模型」，不写死任何参数/协议/能力配置', () => {
    // paramsSchema、metadata.protocolKey、operations、limits、pricingSchema 全部由
    // 运营在 admin 模型配置页填，存 DB。seed 写死它们等于把「这个模型支持哪些参数」
    // 钉在代码里——每次加一个模型、改一档分辨率，都得改代码发版。
    for (const row of IMAGE_ROWS) {
      expect(row.metadata).toEqual({});
    }
    expect(IMAGE_ROWS.length).toBeGreaterThan(0);
  });

  it('模型 id 唯一（seedModels 以 model-id 去重，重复会让第二行永远建不出来）', () => {
    const ids = SEED_MODELS.map((row) => row.model);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
