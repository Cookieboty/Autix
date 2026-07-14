import { PROTOCOL_PRESETS, validateModelProtocolConfig } from '@autix/ai-adapters/image';
import {
  applyParamDefaults,
  compileParamsSchema,
  deriveParams,
  validateParams,
  validateParamsSchema,
} from '@autix/domain/pricing';
import { buildImageParamsSchema, IMAGE_MODEL_PARAMS } from './seed-image-params';
import { SEED_MODELS } from './seed-pricing.models';

const IMAGE_ROWS = SEED_MODELS.filter((row) => row.capabilities.includes('image'));

describe('buildImageParamsSchema — 逐模型参数表', () => {
  it('每个 seed 的图片模型都登记在 IMAGE_MODEL_PARAMS 里', () => {
    for (const row of IMAGE_ROWS) {
      expect(IMAGE_MODEL_PARAMS[row.model]).toBeDefined();
    }
    expect(IMAGE_ROWS.length).toBeGreaterThan(0);
  });

  it('未登记的模型直接抛 —— 不做静默兜底（老代码正是靠兜底让用户选到模型不支持的档位）', () => {
    expect(() => buildImageParamsSchema({ model: 'no-such-model' })).toThrow(/no-such-model/);
  });

  it('schema 不含 n（生成张数）—— 它由业务层吃掉，preset 用 count 策略发给上游', () => {
    for (const row of IMAGE_ROWS) {
      const schema = buildImageParamsSchema({ model: row.model });
      expect(schema.properties.n).toBeUndefined();
      expect(schema.properties.count).toBeUndefined();
    }
  });

  it('参考图上传上限落在 x-ui.uploadMax，而不是 JSON-Schema 的 maximum', () => {
    for (const row of IMAGE_ROWS) {
      const refs = buildImageParamsSchema({ model: row.model }).properties.referenceImages;
      expect(refs).toBeDefined();
      expect(refs.maximum).toBeUndefined(); // maximum 会被 ajv 强制 → 多图的画布操作会 400
      expect(refs['x-ui']!.uploadMax).toBe(IMAGE_MODEL_PARAMS[row.model].uploadMax);
      expect(refs['x-ui']!.role).toBe('pricing'); // 只计价，不发给上游
    }
  });

  // 回归守卫：referenceImages 的值是「实际附了几张图」，被 ajv 校验，而 image_generation
  // 的 schema 是 chat/canvas/公开生成器共享的。canvas 的参考图数量上游无限制 —— 只要
  // 有人给它设了 maximum，多图的画布操作就会在扣费前 400。
  it('12 张参考图仍然通过校验（上传上限绝不能变成 ajv 硬约束）', () => {
    for (const row of IMAGE_ROWS) {
      const schema = buildImageParamsSchema({ model: row.model });
      const params = deriveParams(schema, applyParamDefaults(schema, { referenceImages: 12 }));
      expect(validateParams(schema, params)).toEqual([]);
    }
  });

  it('每个模型的 schema 结构合法且能被 ajv 编译（墙 2：坏 schema 不能存进库）', () => {
    for (const row of IMAGE_ROWS) {
      const schema = buildImageParamsSchema({ model: row.model });
      expect(validateParamsSchema(schema)).toEqual([]);
      expect(compileParamsSchema(schema)).toEqual([]);
    }
  });

  it('调用方什么都不传时，默认值填完仍然满足 required', () => {
    for (const row of IMAGE_ROWS) {
      const schema = buildImageParamsSchema({ model: row.model });
      const params = deriveParams(schema, applyParamDefaults(schema, {}));
      expect(validateParams(schema, params)).toEqual([]);
    }
  });
});

describe('跨配置校验（spec §7.2 的构建期防线）', () => {
  // paramsSchema 在 DB（运营可改）、preset 在代码——两份独立配置，会分叉。
  // 这条断言就是 CI 对「所有 preset × 所有 seed 模型」跑的那一次。
  it('每个 seed 模型的 schema + metadata + preset 零违规', () => {
    for (const row of IMAGE_ROWS) {
      const spec = IMAGE_MODEL_PARAMS[row.model];
      const violations = validateModelProtocolConfig({
        paramsSchema: buildImageParamsSchema({ model: row.model }),
        metadata: row.metadata,
        preset: PROTOCOL_PRESETS[spec.protocolKey],
      });
      expect({ model: row.model, violations }).toEqual({ model: row.model, violations: [] });
    }
  });

  it('每个模型的 protocolKey 都解析得到一个已注册的 preset', () => {
    for (const row of IMAGE_ROWS) {
      const { protocolKey } = IMAGE_MODEL_PARAMS[row.model];
      expect(PROTOCOL_PRESETS[protocolKey]).toBeDefined();
    }
  });

  // 逐模型的校验器**不再**因为「preset 绑了本模型没有的参数」而报错——厂商 preset 会被
  // 同厂商能力不同的模型共用，必然绑定超集。作者拼错参数名的检查因此挪到这一层：
  // preset 的每个绑定，必须至少被走该 preset 的某一个模型认领。
  it('preset 的每个绑定都至少被一个模型认领（抓拼写错误）', () => {
    for (const [protocolKey, preset] of Object.entries(PROTOCOL_PRESETS)) {
      const claimed = new Set<string>();
      for (const row of IMAGE_ROWS) {
        const spec = IMAGE_MODEL_PARAMS[row.model];
        if (spec.protocolKey !== protocolKey) continue;
        for (const name of Object.keys(spec.properties)) claimed.add(name);
      }
      if (claimed.size === 0) continue; // 该 preset 暂无模型使用

      for (const [name, binding] of Object.entries(preset.paramBindings)) {
        const sources =
          typeof binding === 'object' && binding !== null && 'composeFrom' in binding && binding.composeFrom
            ? binding.composeFrom
            : [name];
        for (const source of sources) {
          expect({ protocolKey, binding: source, claimed: claimed.has(source) })
            .toEqual({ protocolKey, binding: source, claimed: true });
        }
      }
    }
  });
});

describe('统一参数词汇', () => {
  it('前端只看到统一命名 —— 厂商原生字段名一个都不进 schema', () => {
    const VENDOR_FIELDS = [
      'aspect_ratio',
      'image_size',
      'enable_safety_checker',
      'prompt_optimizer',
      'output_format',
      'thinking_level',
    ];
    for (const row of IMAGE_ROWS) {
      const names = Object.keys(buildImageParamsSchema({ model: row.model }).properties);
      for (const vendorField of VENDOR_FIELDS) {
        expect(names).not.toContain(vendorField);
      }
    }
  });

  it('模型不支持的参数，它的 schema 里就没有', () => {
    // MiniMax 没有分辨率档位；gemini-2.5-flash 只有比例；只有 gpt-image 有质量轴
    expect(buildImageParamsSchema({ model: 'MiniMax-Image-01' }).properties.resolution).toBeUndefined();
    expect(buildImageParamsSchema({ model: 'gemini-2.5-flash-image' }).properties.resolution).toBeUndefined();
    expect(buildImageParamsSchema({ model: 'doubao-seedream-4-5' }).properties.quality).toBeUndefined();
    expect(buildImageParamsSchema({ model: 'gpt-image-2-official' }).properties.quality).toBeDefined();
  });

  it('分辨率档位逐模型不同（doubao 5.0-lite 是 2K/3K，不是 2K/4K）', () => {
    expect(buildImageParamsSchema({ model: 'doubao-seedream-4-5' }).properties.resolution.enum)
      .toEqual(['2K', '4K']);
    expect(buildImageParamsSchema({ model: 'doubao-seedream-5-0-lite' }).properties.resolution.enum)
      .toEqual(['2K', '3K']);
  });
});
