import { describe, expect, it } from 'vitest';
import { resolveConstraints } from './constraints';
import type { ParamsSchema } from './types';

const schema: ParamsSchema = {
  type: 'object',
  properties: {
    resolution: { type: 'string', enum: ['480p', '720p', '4k'], default: '720p', 'x-ui': { control: 'chips' } },
    seconds: { type: 'integer', minimum: 4, maximum: 15, default: 5, 'x-ui': { control: 'stepper' } },
  },
  allOf: [
    { if: { properties: { resolution: { const: '4k' } } }, then: { properties: { seconds: { maximum: 8 } } } },
  ],
};

describe('resolveConstraints', () => {
  it('returns the base constraints when no if matches', () => {
    const resolved = resolveConstraints(schema, { resolution: '720p' });
    expect(resolved.seconds).toEqual({ minimum: 4, maximum: 15 });
    expect(resolved.resolution).toEqual({ enum: ['480p', '720p', '4k'] });
  });

  it('narrows maximum when the if matches', () => {
    const resolved = resolveConstraints(schema, { resolution: '4k' });
    expect(resolved.seconds).toEqual({ minimum: 4, maximum: 8 });
  });

  it('leaves unrelated params untouched', () => {
    const resolved = resolveConstraints(schema, { resolution: '4k' });
    expect(resolved.resolution).toEqual({ enum: ['480p', '720p', '4k'] });
  });

  it('applies later allOf entries over earlier ones', () => {
    const layered: ParamsSchema = {
      ...schema,
      allOf: [
        { if: { properties: { resolution: { const: '4k' } } }, then: { properties: { seconds: { maximum: 8 } } } },
        { if: { properties: { resolution: { const: '4k' } } }, then: { properties: { seconds: { maximum: 6 } } } },
      ],
    };
    expect(resolveConstraints(layered, { resolution: '4k' }).seconds?.maximum).toBe(6);
  });

  it('can narrow an enum', () => {
    const enumNarrowing: ParamsSchema = {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['fast', 'quality'], default: 'fast', 'x-ui': { control: 'chips' } },
        resolution: { type: 'string', enum: ['1K', '4K'], default: '1K', 'x-ui': { control: 'chips' } },
      },
      allOf: [
        { if: { properties: { mode: { const: 'fast' } } }, then: { properties: { resolution: { enum: ['1K'] } } } },
      ],
    };
    expect(resolveConstraints(enumNarrowing, { mode: 'fast' }).resolution?.enum).toEqual(['1K']);
    expect(resolveConstraints(enumNarrowing, { mode: 'quality' }).resolution?.enum).toEqual(['1K', '4K']);
  });

  it('does not match when the guarded param is absent', () => {
    expect(resolveConstraints(schema, {}).seconds?.maximum).toBe(15);
  });

  it('handles a schema with no allOf', () => {
    const plain: ParamsSchema = { type: 'object', properties: schema.properties };
    expect(resolveConstraints(plain, {}).seconds).toEqual({ minimum: 4, maximum: 15 });
  });

  it('excludes type key from overridden constraints', () => {
    const schemaWithTypeInThen: ParamsSchema = {
      type: 'object',
      properties: {
        resolution: { type: 'string', enum: ['480p', '720p', '4k'], default: '720p', 'x-ui': { control: 'chips' } },
        seconds: { type: 'integer', minimum: 4, maximum: 15, default: 5, 'x-ui': { control: 'stepper' } },
      },
      allOf: [
        { if: { properties: { resolution: { const: '4k' } } }, then: { properties: { seconds: { type: 'integer', maximum: 8 } as any } } },
      ],
    };
    const resolved = resolveConstraints(schemaWithTypeInThen, { resolution: '4k' });
    expect(resolved.seconds.maximum).toBe(8);
    // Verify type key is NOT leaked into the resolved constraint
    expect(Object.keys(resolved.seconds).sort()).toEqual(['maximum', 'minimum']);
    expect('type' in resolved.seconds).toBe(false);
  });

  it('requires all guarded params to match (conjunctive)', () => {
    const multiGuard: ParamsSchema = {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['fast', 'quality'], default: 'fast', 'x-ui': { control: 'chips' } },
        resolution: { type: 'string', enum: ['1K', '4K'], default: '1K', 'x-ui': { control: 'chips' } },
        seconds: { type: 'integer', minimum: 4, maximum: 15, default: 5, 'x-ui': { control: 'stepper' } },
      },
      allOf: [
        { if: { properties: { mode: { const: 'fast' }, resolution: { const: '4K' } } }, then: { properties: { seconds: { maximum: 8 } } } },
      ],
    };
    // Both guards satisfied → override applies
    expect(resolveConstraints(multiGuard, { mode: 'fast', resolution: '4K' }).seconds?.maximum).toBe(8);
    // Only first guard satisfied → override does NOT apply
    expect(resolveConstraints(multiGuard, { mode: 'fast', resolution: '1K' }).seconds?.maximum).toBe(15);
    // Only second guard satisfied → override does NOT apply
    expect(resolveConstraints(multiGuard, { mode: 'quality', resolution: '4K' }).seconds?.maximum).toBe(15);
    // Neither guard satisfied → override does NOT apply
    expect(resolveConstraints(multiGuard, { mode: 'quality', resolution: '1K' }).seconds?.maximum).toBe(15);
  });

  it('returns properties with no constraints as empty objects', () => {
    const noConstraints: ParamsSchema = {
      type: 'object',
      properties: {
        name: { type: 'string', default: 'default' },
      },
    };
    const resolved = resolveConstraints(noConstraints, {});
    expect('name' in resolved).toBe(true);
    expect(resolved.name).toEqual({});
  });
});
