import { afterEach, describe, expect, it } from 'vitest';
import {
  IMAGE_TIER_WIDTHS,
  __setAllowedImageHostsForTest,
  buildTieredImageUrl,
  buildTieredSrcSet,
} from './url';

const CDN = 'https://cdn.amux.test';

describe('buildTieredImageUrl', () => {
  afterEach(() => __setAllowedImageHostsForTest(null));

  it('returns empty string for nullish input', () => {
    expect(buildTieredImageUrl(null)).toBe('');
    expect(buildTieredImageUrl(undefined)).toBe('');
    expect(buildTieredImageUrl('')).toBe('');
  });

  it('passes through data: / blob: / relative URLs unchanged', () => {
    expect(buildTieredImageUrl('data:image/png;base64,AAA')).toBe('data:image/png;base64,AAA');
    expect(buildTieredImageUrl('blob:https://example.com/xxx')).toBe('blob:https://example.com/xxx');
    expect(buildTieredImageUrl('/favicon.png')).toBe('/favicon.png');
    expect(buildTieredImageUrl('assets/a.png')).toBe('assets/a.png');
  });

  it('does not rewrite external domains', () => {
    const external = 'https://images.unsplash.com/photo-1?w=360';
    expect(buildTieredImageUrl(external)).toBe(external);
  });

  it('defaults to pad tier (1024) with locked quality/fit/format', () => {
    expect(buildTieredImageUrl(`${CDN}/a.jpg`)).toBe(
      `${CDN}/cdn-cgi/image/w=1024,q=75,fit=cover,f=auto/a.jpg`,
    );
  });

  it('supports mobile / pad / pc tiers', () => {
    expect(buildTieredImageUrl(`${CDN}/a.jpg`, 'mobile')).toBe(
      `${CDN}/cdn-cgi/image/w=640,q=75,fit=cover,f=auto/a.jpg`,
    );
    expect(buildTieredImageUrl(`${CDN}/a.jpg`, 'pc')).toBe(
      `${CDN}/cdn-cgi/image/w=1920,q=75,fit=cover,f=auto/a.jpg`,
    );
  });

  it('does not double-wrap URLs already using /cdn-cgi/image/', () => {
    const already = `${CDN}/cdn-cgi/image/w=400,f=auto/x.png`;
    expect(buildTieredImageUrl(already)).toBe(already);
  });

  it('preserves query string and hash', () => {
    expect(buildTieredImageUrl(`${CDN}/x.png?v=2#a`, 'mobile')).toBe(
      `${CDN}/cdn-cgi/image/w=640,q=75,fit=cover,f=auto/x.png?v=2#a`,
    );
  });

  it('respects env-configured host whitelist', () => {
    __setAllowedImageHostsForTest(['cdn.mydomain.com']);
    expect(buildTieredImageUrl('https://cdn.mydomain.com/a.jpg', 'pad')).toBe(
      'https://cdn.mydomain.com/cdn-cgi/image/w=1024,q=75,fit=cover,f=auto/a.jpg',
    );
    expect(buildTieredImageUrl(`${CDN}/a.jpg`)).toBe(`${CDN}/a.jpg`);
  });
});

describe('buildTieredSrcSet', () => {
  it('always emits exactly 3 candidates in tier order', () => {
    const out = buildTieredSrcSet(`${CDN}/a.jpg`);
    expect(out.split(', ')).toHaveLength(3);
    expect(IMAGE_TIER_WIDTHS).toEqual([640, 1024, 1920]);
    expect(out).toBe(
      `${CDN}/cdn-cgi/image/w=640,q=75,fit=cover,f=auto/a.jpg 640w, ${CDN}/cdn-cgi/image/w=1024,q=75,fit=cover,f=auto/a.jpg 1024w, ${CDN}/cdn-cgi/image/w=1920,q=75,fit=cover,f=auto/a.jpg 1920w`,
    );
  });

  it('returns empty string for nullish / non-transformable src', () => {
    expect(buildTieredSrcSet(null)).toBe('');
    expect(buildTieredSrcSet('data:image/png;base64,AAA')).toBe('');
    expect(buildTieredSrcSet('/local.png')).toBe('');
  });
});
