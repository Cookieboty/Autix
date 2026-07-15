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

  test('hides marketing, cinema, originals and canvas entries', () => {
    const keys = buildGeneratorNavItems('image').map((i) => i.key);
    for (const hidden of ['marketing', 'cinema', 'originals', 'canvas']) {
      expect(keys).not.toContain(hidden);
    }
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

  test('ends with the video entry; community entry is gone', () => {
    const items = buildGeneratorNavItems('image');
    expect(items.some((i) => i.key === 'community')).toBe(false);
    expect(items[items.length - 1]?.key).toBe('video');
  });
});
