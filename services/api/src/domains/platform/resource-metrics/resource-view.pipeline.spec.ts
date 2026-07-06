import { ResourceType } from '../prisma/generated';
import {
  buildViewRows,
  dayBucket,
  isViewScope,
  minuteBucket,
  viewerKey,
  type ResourceViewEventInput,
} from './resource-view.pipeline';

describe('viewerKey', () => {
  it('prefers userId over visitorId when both are present', () => {
    expect(viewerKey({ userId: 'u1', visitorId: 'v1' })).toBe('u:u1');
  });

  it('falls back to visitorId when userId is absent', () => {
    expect(viewerKey({ visitorId: 'v1' })).toBe('v:v1');
  });

  it('falls back to visitorId when userId is null', () => {
    expect(viewerKey({ userId: null, visitorId: 'v1' })).toBe('v:v1');
  });

  it('returns null when neither userId nor visitorId is present', () => {
    expect(viewerKey({})).toBeNull();
  });

  it('returns null when userId and visitorId are both empty strings', () => {
    expect(viewerKey({ userId: '', visitorId: '' })).toBeNull();
  });
});

describe('minuteBucket', () => {
  it('computes the minute index for an arbitrary timestamp', () => {
    expect(minuteBucket(0)).toBe(0);
    expect(minuteBucket(90_000)).toBe(1);
  });

  it('is stable within the same minute and flips at the boundary', () => {
    expect(minuteBucket(59_999)).toBe(0);
    expect(minuteBucket(60_000)).toBe(1);
    expect(minuteBucket(119_999)).toBe(1);
    expect(minuteBucket(120_000)).toBe(2);
  });
});

describe('dayBucket', () => {
  it('computes the day index for an arbitrary timestamp', () => {
    expect(dayBucket(0)).toBe(0);
    expect(dayBucket(86_400_000 * 3 + 1)).toBe(3);
  });

  it('is stable within the same day and flips at the boundary', () => {
    expect(dayBucket(86_400_000 - 1)).toBe(0);
    expect(dayBucket(86_400_000)).toBe(1);
    expect(dayBucket(86_400_000 * 2 - 1)).toBe(1);
    expect(dayBucket(86_400_000 * 2)).toBe(2);
  });
});

describe('isViewScope', () => {
  it('accepts the three known scopes', () => {
    expect(isViewScope('list')).toBe(true);
    expect(isViewScope('detail')).toBe(true);
    expect(isViewScope('hero')).toBe(true);
  });

  it('rejects unknown strings and non-strings', () => {
    expect(isViewScope('feed')).toBe(false);
    expect(isViewScope('')).toBe(false);
    expect(isViewScope(undefined)).toBe(false);
    expect(isViewScope(null)).toBe(false);
    expect(isViewScope(42)).toBe(false);
  });
});

describe('buildViewRows', () => {
  const now = new Date('2026-01-02T00:00:00.000Z'); // dayBucket(now) = 20454, minuteBucket(now) = 29453760

  it('builds one PV row and one UV row per valid event, sharing the batch bucket', () => {
    const events: ResourceViewEventInput[] = [
      {
        resourceType: ResourceType.GALLERY_POST,
        resourceId: 'post-1',
        scope: 'detail',
        userId: 'u1',
      },
    ];

    const { pvRows, uvRows, acceptedCount } = buildViewRows(events, now);
    const nowMs = now.getTime();

    expect(acceptedCount).toBe(1);
    expect(pvRows).toEqual([
      {
        resourceType: ResourceType.GALLERY_POST,
        resourceId: 'post-1',
        scope: 'detail',
        viewerKey: 'u:u1',
        userId: 'u1',
        visitorId: null,
        sessionId: null,
        minuteBucket: minuteBucket(nowMs),
        dayBucket: dayBucket(nowMs),
      },
    ]);
    expect(uvRows).toEqual([
      {
        resourceType: ResourceType.GALLERY_POST,
        resourceId: 'post-1',
        viewerKey: 'u:u1',
        dayBucket: dayBucket(nowMs),
        firstScope: 'detail',
      },
    ]);
  });

  it('falls back to visitorId-derived viewerKey for anonymous events', () => {
    const events: ResourceViewEventInput[] = [
      {
        resourceType: ResourceType.GALLERY_POST,
        resourceId: 'post-1',
        scope: 'list',
        visitorId: 'anon-1',
      },
    ];

    const { pvRows, uvRows } = buildViewRows(events, now);
    expect(pvRows[0].viewerKey).toBe('v:anon-1');
    expect(uvRows[0].viewerKey).toBe('v:anon-1');
    expect(uvRows[0].firstScope).toBe('list');
  });

  it('discards rows with no userId and no visitorId', () => {
    const events: ResourceViewEventInput[] = [
      { resourceType: ResourceType.GALLERY_POST, resourceId: 'post-1', scope: 'hero' },
    ];

    const { pvRows, uvRows, acceptedCount } = buildViewRows(events, now);
    expect(acceptedCount).toBe(0);
    expect(pvRows).toEqual([]);
    expect(uvRows).toEqual([]);
  });

  it('discards rows with an unknown resourceType', () => {
    const events: ResourceViewEventInput[] = [
      { resourceType: 'NOT_A_TYPE', resourceId: 'post-1', scope: 'detail', userId: 'u1' },
    ];

    expect(buildViewRows(events, now).acceptedCount).toBe(0);
  });

  it('discards rows with an unknown scope', () => {
    const events: ResourceViewEventInput[] = [
      {
        resourceType: ResourceType.GALLERY_POST,
        resourceId: 'post-1',
        scope: 'feed',
        userId: 'u1',
      },
    ];

    expect(buildViewRows(events, now).acceptedCount).toBe(0);
  });

  it('discards rows with an empty resourceId', () => {
    const events: ResourceViewEventInput[] = [
      { resourceType: ResourceType.GALLERY_POST, resourceId: '', scope: 'detail', userId: 'u1' },
    ];

    expect(buildViewRows(events, now).acceptedCount).toBe(0);
  });

  it('processes a mixed batch, keeping only the valid rows and preserving order', () => {
    const events: ResourceViewEventInput[] = [
      { resourceType: ResourceType.GALLERY_POST, resourceId: 'post-1', scope: 'detail', userId: 'u1' },
      { resourceType: 'BOGUS', resourceId: 'post-2', scope: 'detail', userId: 'u2' },
      { resourceType: ResourceType.GALLERY_POST, resourceId: 'post-3', scope: 'list', visitorId: 'v3' },
      { resourceType: ResourceType.GALLERY_POST, resourceId: 'post-4', scope: 'detail' },
    ];

    const { pvRows, acceptedCount } = buildViewRows(events, now);
    expect(acceptedCount).toBe(2);
    expect(pvRows.map((r) => r.resourceId)).toEqual(['post-1', 'post-3']);
  });

  it('returns empty rows for an empty batch', () => {
    expect(buildViewRows([], now)).toEqual({ pvRows: [], uvRows: [], acceptedCount: 0 });
  });
});
