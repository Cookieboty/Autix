import { describe, expect, test } from 'bun:test';
import { buildGeneratorNavItems } from '../src/growth/generator-nav-items';

describe('buildGeneratorNavItems', () => {
  test('contains no standalone audio entry', () => {
    const keys = buildGeneratorNavItems('image').map((i) => i.key);
    expect(keys).not.toContain('audio');
    expect(keys).toContain('image');
    expect(keys).toContain('video');
  });

  test('marks the active kind', () => {
    const img = buildGeneratorNavItems('image');
    expect(img.find((i) => i.key === 'image')!.active).toBe(true);
    expect(img.find((i) => i.key === 'video')!.active).toBe(false);
    const vid = buildGeneratorNavItems('video');
    expect(vid.find((i) => i.key === 'video')!.active).toBe(true);
  });

  test('keeps "new" badges on growth entries', () => {
    const badged = buildGeneratorNavItems('image')
      .filter((i) => i.badge === 'new')
      .map((i) => i.key);
    expect(badged).toEqual(['supercomputer', 'mcp', 'plugins']);
  });
});
