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

  test('does not expose removed growth entries', () => {
    const keys = buildGeneratorNavItems('image').map((i) => i.key);
    for (const removed of ['supercomputer', 'mcp', 'collab', 'plugins', 'apps', 'influencer']) {
      expect(keys).not.toContain(removed);
    }
  });

  test('opens canvas through the draw workspace', () => {
    const canvas = buildGeneratorNavItems('image').find((i) => i.key === 'canvas');
    expect(canvas).toBeDefined();
    expect(canvas!.href).toBe('/draw');
    expect(canvas!.disabled).toBeUndefined();
    expect(canvas!.badge).toBeUndefined();
  });

  test('disables marketing and cinema as coming-soon entries', () => {
    const items = buildGeneratorNavItems('image');
    for (const key of ['marketing', 'cinema']) {
      const item = items.find((i) => i.key === key);
      expect(item).toBeDefined();
      expect(item!.disabled).toBe(true);
      expect(item!.badge).toBeUndefined();
    }
  });

  test('flags originals with a launching-soon badge', () => {
    const items = buildGeneratorNavItems('image');
    const item = items.find((i) => i.key === 'originals');
    expect(item).toBeDefined();
    expect(item!.disabled).toBe(true);
    expect(item!.badge).toBe('soon');
  });

  test('places the separator after the video entry', () => {
    const items = buildGeneratorNavItems('image');
    // The divider sits after the core generation tools (image/video).
    expect(items.find((i) => i.key === 'video')?.separatorAfter).toBe(true);
  });

  test('starts with the explore entry that links home', () => {
    const items = buildGeneratorNavItems('home');
    expect(items[0]?.key).toBe('explore');
    expect(items[0]?.href).toBe('/');
    expect(items[0]?.active).toBe(true);
  });

  test('lists secondary entries after community with canvas enabled', () => {
    const items = buildGeneratorNavItems('image');
    const communityIndex = items.findIndex((i) => i.key === 'community');
    for (const key of ['marketing', 'cinema', 'originals']) {
      const item = items.find((i) => i.key === key);
      expect(item?.disabled).toBe(true);
      expect(items.findIndex((i) => i.key === key)).toBeGreaterThan(communityIndex);
    }
    const canvas = items.find((i) => i.key === 'canvas');
    expect(canvas?.disabled).toBeUndefined();
    expect(items.findIndex((i) => i.key === 'canvas')).toBeGreaterThan(communityIndex);
  });
});
