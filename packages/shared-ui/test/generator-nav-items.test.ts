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

  test('marks canvas as disabled', () => {
    const canvas = buildGeneratorNavItems('image').find((i) => i.key === 'canvas');
    expect(canvas).toBeDefined();
    expect(canvas!.disabled).toBe(true);
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

  test('flags originals and canvas with a launching-soon badge', () => {
    const items = buildGeneratorNavItems('image');
    for (const key of ['originals', 'canvas']) {
      const item = items.find((i) => i.key === key);
      expect(item).toBeDefined();
      expect(item!.disabled).toBe(true);
      expect(item!.badge).toBe('soon');
    }
  });

  test('places a separator after the active tools, before coming-soon entries', () => {
    const items = buildGeneratorNavItems('image');
    // community is the last active (non-disabled) tool; the divider fences the
    // active tools (image/video/community) from the coming-soon disabled ones.
    const community = items.find((i) => i.key === 'community');
    expect(community?.separatorAfter).toBe(true);
    expect(items.find((i) => i.key === 'video')?.separatorAfter).toBeUndefined();
    const communityIndex = items.findIndex((i) => i.key === 'community');
    const marketingIndex = items.findIndex((i) => i.key === 'marketing');
    // marketing is the first coming-soon entry, immediately after the separator
    expect(marketingIndex).toBe(communityIndex + 1);
  });
});
