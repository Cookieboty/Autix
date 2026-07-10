import { describe, expect, test } from 'bun:test';
import { layoutProperties } from '../src/pricing/SchemaForm/schema-layout';
import type { ParamsSchema } from '@autix/domain/pricing';

const schema: ParamsSchema = {
  type: 'object',
  properties: {
    seconds: { type: 'integer', minimum: 4, maximum: 15, default: 5, 'x-ui': { control: 'stepper', order: 20 } },
    resolution: { type: 'string', enum: ['1K', '4K'], default: '1K', 'x-ui': { control: 'chips', order: 10 } },
    guidanceScale: { type: 'number', minimum: 1, maximum: 20, default: 7, 'x-ui': { control: 'slider', group: 'advanced', order: 10 } },
    steps: { type: 'integer', minimum: 4, maximum: 60, default: 20, 'x-ui': { control: 'stepper', group: 'advanced' } },
    seed: { type: 'string', 'x-ui': { control: 'text', group: 'advanced', order: 5 } },
    inputTokens: { type: 'integer', minimum: 0, default: 0, 'x-ui': { control: 'hidden' } },
  },
};

describe('layoutProperties', () => {
  test('sorts ungrouped properties by x-ui.order', () => {
    const groups = layoutProperties(schema);
    const ungrouped = groups.find((g) => g.group === undefined)!;
    expect(ungrouped.entries.map((e) => e.name)).toEqual(['resolution', 'seconds', 'inputTokens']);
  });

  test('places the ungrouped bucket first', () => {
    const groups = layoutProperties(schema);
    expect(groups[0].group).toBeUndefined();
  });

  test('groups by x-ui.group and orders within the group, missing order last in declaration order', () => {
    const groups = layoutProperties(schema);
    const advanced = groups.find((g) => g.group === 'advanced')!;
    // seed: order 5, guidanceScale: order 10, steps: no order (declared after guidanceScale) -> declaration order tie-break
    expect(advanced.entries.map((e) => e.name)).toEqual(['seed', 'guidanceScale', 'steps']);
  });

  test('keeps hidden controls in the layout — they still need to reach the form state', () => {
    const groups = layoutProperties(schema);
    const ungrouped = groups.find((g) => g.group === undefined)!;
    expect(ungrouped.entries.some((e) => e.name === 'inputTokens')).toBe(true);
  });

  test('is empty-safe', () => {
    expect(layoutProperties({ type: 'object', properties: {} })).toEqual([]);
  });
});
