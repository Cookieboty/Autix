import { ResourceType } from '../prisma/generated';
import { buildDefaultMetrics, clampDecrement } from './resource-metrics.util';

describe('clampDecrement', () => {
  it('decrements normally when result stays non-negative', () => {
    expect(clampDecrement(5, 1)).toBe(4);
  });

  it('clamps at 0 instead of going negative', () => {
    expect(clampDecrement(0, 1)).toBe(0);
  });

  it('clamps at 0 when current is already below the decrement amount', () => {
    expect(clampDecrement(1, 5)).toBe(0);
  });

  it('defaults `by` to 1 when omitted', () => {
    expect(clampDecrement(3)).toBe(2);
  });
});

describe('buildDefaultMetrics', () => {
  it('returns an all-zero snapshot for a resource with no metrics row yet', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const snapshot = buildDefaultMetrics(ResourceType.GALLERY_POST, 'post-1', now);

    expect(snapshot).toEqual({
      resourceType: ResourceType.GALLERY_POST,
      resourceId: 'post-1',
      pvCount: 0,
      uvCount: 0,
      viewCount: 0,
      likeCount: 0,
      favoriteCount: 0,
      commentCount: 0,
      shareCount: 0,
      referenceCount: 0,
      downloadCount: 0,
      citationCount: 0,
      hotScore: 0,
      hotScoreVersion: null,
      boostScore: 0,
      boostExpiresAt: null,
      firstSeenAt: now,
      lastActivityAt: now,
      updatedAt: now,
    });
  });

  it('defaults `now` to the current time when omitted', () => {
    const before = Date.now();
    const snapshot = buildDefaultMetrics(ResourceType.SKILL, 'skill-1');
    const after = Date.now();

    expect(snapshot.firstSeenAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(snapshot.firstSeenAt.getTime()).toBeLessThanOrEqual(after);
    expect(snapshot.lastActivityAt).toBe(snapshot.firstSeenAt);
  });
});
