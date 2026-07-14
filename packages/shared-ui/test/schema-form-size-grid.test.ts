import { describe, expect, test } from 'bun:test';
import { buildSizeGridView, visibleEntries } from '../src/pricing/SchemaForm/schema-form-logic';
import type { ParamsSchema } from '@autix/domain/pricing';

const SCHEMA: ParamsSchema = {
  type: 'object',
  required: ['size', 'resolution'],
  properties: {
    size: {
      type: 'string',
      enum: ['1024x1024@1K', '2048x2048@2K'],
      default: '1024x1024@1K',
      'x-ui': { role: 'wire', control: 'size-grid', groupBy: 'tier', order: 10 },
    },
    resolution: {
      type: 'string',
      enum: ['1K', '2K'],
      default: '1K',
      'x-ui': {
        role: 'derived',
        control: 'hidden',
        derivedFrom: { param: 'size', via: 'imagePricingResolution' },
        order: 21,
      },
    },
    referenceImages: {
      type: 'integer',
      minimum: 0,
      default: 0,
      'x-ui': { role: 'pricing', control: 'hidden' },
    },
  },
};

describe('SchemaForm — role 过滤', () => {
  test('never renders a derived param, even if its control is not hidden', () => {
    // 变异测试：derived 的 control 写成 'chips'（配置错误），SchemaForm 仍必须不渲染它 ——
    // 派生参数由服务端算，渲染出来就是让用户改一个改不动的东西（spec §6.1 role 表）
    const schema: ParamsSchema = {
      ...SCHEMA,
      properties: {
        ...SCHEMA.properties,
        resolution: {
          ...SCHEMA.properties.resolution,
          'x-ui': {
            role: 'derived',
            control: 'chips',
            derivedFrom: { param: 'size', via: 'imagePricingResolution' },
          },
        },
      },
    };
    expect(visibleEntries(schema).map((e) => e.name)).not.toContain('resolution');
  });

  test('renders a wire param (size) — role wire is about billing, not visibility', () => {
    expect(visibleEntries(SCHEMA).map((e) => e.name)).toContain('size');
  });

  test('still skips control: hidden', () => {
    expect(visibleEntries(SCHEMA).map((e) => e.name)).not.toContain('referenceImages');
  });
});

describe('buildSizeGridView —— size-grid 的读模型（纯函数）', () => {
  const OPTIONS = [
    { value: '1024x1024@1K', label: '1:1' },
    { value: '1344x768@1K', label: '16:9' },
    { value: '2048x2048@2K', label: '1:1' },
  ];

  test('groups by tier when groupBy is "tier" — 分组规则来自 x-ui.groupBy，不来自 modelFamily（口径 1）', () => {
    const view = buildSizeGridView(OPTIONS, 'tier', '1024x1024@1K');
    expect(view.groups.map((g) => g.value)).toEqual(['1K', '2K']);
    expect(view.selectedTier).toBe('1K');
    expect(view.selectedAspect).toBe('1:1');
  });

  test('shows the literal optionLabels (1:1 / 16:9), not raw WxH tokens', () => {
    const view = buildSizeGridView(OPTIONS, 'tier', '1344x768@1K');
    expect(view.aspectOptions.map((a) => a.label)).toEqual(['1:1', '16:9']);
    expect(view.displayLabel).toBe('16:9');
  });

  test('keeps the aspect when switching tier', () => {
    const view = buildSizeGridView(OPTIONS, 'tier', '1024x1024@1K');
    expect(view.pickTier('2K')).toBe('2048x2048@2K'); // 1:1 保住了
  });

  test('falls back to a flat list for an unknown groupBy — never throws', () => {
    const view = buildSizeGridView(OPTIONS, 'colour', '1024x1024@1K');
    expect(view.groups).toHaveLength(1);
    expect(view.aspectOptions).toHaveLength(3);
  });
});
