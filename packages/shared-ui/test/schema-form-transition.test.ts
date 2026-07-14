import type { ParamsSchema } from '@autix/domain/pricing';
import { resolveSchemaTransition } from '../src/pricing/SchemaForm/schema-form-logic';

// 图片计价 schema 的最小形状：一个有默认值的 quality 枚举 + 一个数量 stepper。
const imageSchema: ParamsSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['quality'],
  properties: {
    quality: {
      type: 'string',
      enum: ['low', 'medium', 'high'],
      default: 'medium',
      'x-ui': { control: 'chips', labelKey: 'pricing.params.quality', order: 10 },
    },
    quantity: {
      type: 'integer',
      minimum: 1,
      maximum: 4,
      default: 1,
      'x-ui': { control: 'stepper', labelKey: 'pricing.params.quantity', order: 20 },
    },
  },
};

describe('resolveSchemaTransition (useSchemaForm 生命周期)', () => {
  test('schema 未加载时保持空 params', () => {
    expect(resolveSchemaTransition(undefined, undefined, {}, { quality: 'high' })).toEqual({});
  });

  // 核心回归：先以 undefined schema 挂载（params={}），schema 异步到达后必须用
  // initialParams（= 当前生成设置）播种，而不是退化成纯 schema 默认值。
  // 若这条断言变成 { quality: 'medium', quantity: 1 }（纯默认值），说明异步到达
  // 又会覆盖已有设置了。
  test('schema 异步到达：用 initialParams 播种，不退化成纯默认值', () => {
    const seeded = resolveSchemaTransition(undefined, imageSchema, {}, { quality: 'high', quantity: 3 });
    expect(seeded).toEqual({ quality: 'high', quantity: 3 });
    expect(seeded.quality).not.toBe('medium'); // 不是 schema 默认值
  });

  test('schema 异步到达：initialParams 缺省的键回退到 schema 默认值', () => {
    // 只提供 quality，quantity 应回退默认 1（fillDefaults），不丢失该键。
    expect(resolveSchemaTransition(undefined, imageSchema, {}, { quality: 'low' })).toEqual({
      quality: 'low',
      quantity: 1,
    });
  });

  test('schema 变为 undefined（模型清单被清空）时清空 params', () => {
    expect(resolveSchemaTransition(imageSchema, undefined, { quality: 'high' }, undefined)).toEqual({});
  });

  test('模型切换（两个真 schema）走 migrateParams：保留仍合法的旧值，丢弃越界值', () => {
    // quantity 5 超过 max 4 -> 回退默认 1；quality 'high' 合法 -> 保留。
    const migrated = resolveSchemaTransition(
      imageSchema,
      imageSchema,
      { quality: 'high', quantity: 5 },
      { quality: 'low' }, // 迁移分支忽略 initialParams（那是挂载/首帧用的）
    );
    expect(migrated).toEqual({ quality: 'high', quantity: 1 });
  });
});
