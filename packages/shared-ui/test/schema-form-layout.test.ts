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

// Two NAMED groups (neither is the ungrouped bucket), each with a different
// minimum child `order`, plus an order-less-siblings tie-break inside one
// bucket — covers layoutProperties' two untested tie-break rules:
// (a) group-vs-group ordering uses the minimum child order per group;
// (b) siblings that both lack `order` keep their schema.properties
//     declaration order (not e.g. alphabetical or reversed).
const multiGroupSchema: ParamsSchema = {
  type: 'object',
  properties: {
    // group 'lighting': min order is 30
    exposure: { type: 'number', 'x-ui': { control: 'slider', group: 'lighting', order: 30 } },
    // group 'camera': min order is 15 -> camera group must be laid out before lighting
    aperture: { type: 'number', 'x-ui': { control: 'slider', group: 'camera', order: 40 } },
    focalLength: { type: 'number', 'x-ui': { control: 'slider', group: 'camera', order: 15 } },
    // order-less siblings within 'camera', declared in this order — must survive as-is
    lensType: { type: 'string', 'x-ui': { control: 'text', group: 'camera' } },
    filter: { type: 'string', 'x-ui': { control: 'text', group: 'camera' } },
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

  test('orders two named groups by their minimum child order — camera (min 15) before lighting (min 30)', () => {
    const groups = layoutProperties(multiGroupSchema);
    const namedGroupNames = groups.filter((g) => g.group !== undefined).map((g) => g.group);
    expect(namedGroupNames).toEqual(['camera', 'lighting']);
  });

  test('two order-less siblings in the same group keep their schema.properties declaration order', () => {
    const groups = layoutProperties(multiGroupSchema);
    const camera = groups.find((g) => g.group === 'camera')!;
    // focalLength (order 15) and aperture (order 40) sort first by order;
    // lensType and filter both lack `order` and must fall back to the order
    // they were declared in (lensType before filter), not be reordered.
    expect(camera.entries.map((e) => e.name)).toEqual(['focalLength', 'aperture', 'lensType', 'filter']);
  });
});
