import type { FeaturedSlot } from '@autix/domain';
import {
  assertFeaturedSlot,
  resolveSlot,
} from './featured-slots.helpers';

const slot = (over: Partial<FeaturedSlot> = {}): FeaturedSlot => ({
  id: 's1',
  placement: 'home_hero',
  kind: 'CUSTOM',
  resourceType: null,
  resourceId: null,
  overrideTitle: null,
  overrideDescription: null,
  overrideCoverImage: null,
  overrideCoverVideo: null,
  overrideCtaText: null,
  overrideCtaHref: null,
  position: 0,
  isEnabled: true,
  startsAt: null,
  endsAt: null,
  ...over,
});

describe('resolveSlot (§十 override ?? source)', () => {
  it('CUSTOM：全部取 override', () => {
    const r = resolveSlot(
      slot({ overrideTitle: 'Seedance', overrideCoverVideo: 'v.mp4' }),
    );
    expect(r.title).toBe('Seedance');
    expect(r.coverVideo).toBe('v.mp4');
  });

  it('RESOURCE：override 缺失时回落 source，不回写', () => {
    const r = resolveSlot(
      slot({
        kind: 'RESOURCE',
        resourceType: 'IMAGE_TEMPLATE',
        resourceId: 't1',
        overrideTitle: '运营标题',
      }),
      { title: '原标题', coverImage: 'orig.png', href: '/x' },
    );
    expect(r.title).toBe('运营标题'); // override 优先
    expect(r.coverImage).toBe('orig.png'); // 回落 source
    expect(r.ctaHref).toBe('/x');
  });
});

describe('assertFeaturedSlot (§5.5)', () => {
  it('RESOURCE 缺 resourceId → 抛错', () => {
    expect(() =>
      assertFeaturedSlot({
        kind: 'RESOURCE',
        resourceType: 'IMAGE_TEMPLATE',
        resourceId: null,
      }),
    ).toThrow();
  });
  it('RESOURCE 齐全 → 通过', () => {
    expect(() =>
      assertFeaturedSlot({
        kind: 'RESOURCE',
        resourceType: 'GALLERY_POST',
        resourceId: 'p1',
      }),
    ).not.toThrow();
  });
  it('CUSTOM 带 resourceId → 抛错', () => {
    expect(() =>
      assertFeaturedSlot({
        kind: 'CUSTOM',
        resourceType: null,
        resourceId: 'p1',
      }),
    ).toThrow();
  });
});
