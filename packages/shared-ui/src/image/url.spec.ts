import { afterEach, describe, expect, it } from 'vitest';
import {
  __setAllowedImageHostsForTest,
  buildImagePlaceholder,
  buildImageSrcSet,
  buildImageUrl,
} from './url';

const CDN = 'https://cdn.amux.test';

describe('buildImageUrl', () => {
  afterEach(() => __setAllowedImageHostsForTest(null));

  it('returns empty string for nullish input', () => {
    expect(buildImageUrl(null)).toBe('');
    expect(buildImageUrl(undefined)).toBe('');
    expect(buildImageUrl('')).toBe('');
  });

  it('passes through data: / blob: URLs unchanged', () => {
    expect(buildImageUrl('data:image/png;base64,AAA')).toBe('data:image/png;base64,AAA');
    expect(buildImageUrl('blob:https://example.com/xxx')).toBe('blob:https://example.com/xxx');
  });

  it('passes through relative paths', () => {
    expect(buildImageUrl('/favicon.png', { width: 100 })).toBe('/favicon.png');
    expect(buildImageUrl('assets/a.png')).toBe('assets/a.png');
  });

  it('does not rewrite external domains', () => {
    const external = 'https://images.unsplash.com/photo-1?w=360';
    expect(buildImageUrl(external, { width: 400 })).toBe(external);
  });

  it('rewrites CDN URLs with transform options and defaults to f=auto', () => {
    const out = buildImageUrl(`${CDN}/gallery/abc.jpg`, { width: 800, quality: 80 });
    expect(out).toBe(`${CDN}/cdn-cgi/image/w=800,q=80,f=auto/gallery/abc.jpg`);
  });

  it('honours explicit format and fit', () => {
    const out = buildImageUrl(`${CDN}/x.png`, { width: 200, format: 'webp', fit: 'cover' });
    expect(out).toBe(`${CDN}/cdn-cgi/image/w=200,f=webp,fit=cover/x.png`);
  });

  it('does not double-wrap URLs already using /cdn-cgi/image/', () => {
    const already = `${CDN}/cdn-cgi/image/w=400,f=auto/x.png`;
    expect(buildImageUrl(already, { width: 800 })).toBe(already);
  });

  it('preserves query string and hash', () => {
    const out = buildImageUrl(`${CDN}/x.png?v=2#a`, { width: 100 });
    expect(out).toBe(`${CDN}/cdn-cgi/image/w=100,f=auto/x.png?v=2#a`);
  });

  it('respects env-configured host whitelist', () => {
    __setAllowedImageHostsForTest(['cdn.mydomain.com']);
    const out = buildImageUrl('https://cdn.mydomain.com/a.jpg', { width: 200 });
    expect(out).toBe('https://cdn.mydomain.com/cdn-cgi/image/w=200,f=auto/a.jpg');
    // 现在默认的 cdn.autix.test 也应该被覆盖掉
    expect(buildImageUrl(`${CDN}/a.jpg`, { width: 200 })).toBe(`${CDN}/a.jpg`);
  });

  it('clamps quality and blur into legal ranges', () => {
    const out = buildImageUrl(`${CDN}/x.jpg`, { quality: 999, blur: 999 });
    expect(out).toContain('q=100');
    expect(out).toContain('blur=250');
  });

  it('clamps dpr to CF max of 2', () => {
    expect(buildImageUrl(`${CDN}/x.jpg`, { dpr: 3 })).toContain('dpr=2');
    expect(buildImageUrl(`${CDN}/x.jpg`, { dpr: 0.5 })).toContain('dpr=1');
  });

  it('supports baseline-jpeg format', () => {
    const out = buildImageUrl(`${CDN}/x.jpg`, { format: 'baseline-jpeg' });
    expect(out).toContain('f=baseline-jpeg');
  });

  it('accepts hex background but drops comma-containing colors', () => {
    expect(buildImageUrl(`${CDN}/x.png`, { background: '#ffffff' })).toContain(
      'background=%23ffffff',
    );
    // rgb(...) 含逗号会撕裂选项列表，应被丢弃而非破坏 URL
    expect(buildImageUrl(`${CDN}/x.png`, { background: 'rgb(255,0,0)' })).not.toContain(
      'background=',
    );
  });
});

describe('buildImageSrcSet', () => {
  it('generates one candidate per width', () => {
    const out = buildImageSrcSet(`${CDN}/a.jpg`, [400, 800, 1600], { quality: 75 });
    expect(out).toBe(
      `${CDN}/cdn-cgi/image/w=400,q=75,f=auto/a.jpg 400w, ${CDN}/cdn-cgi/image/w=800,q=75,f=auto/a.jpg 800w, ${CDN}/cdn-cgi/image/w=1600,q=75,f=auto/a.jpg 1600w`,
    );
  });

  it('drops non-positive widths', () => {
    const out = buildImageSrcSet(`${CDN}/a.jpg`, [0, -1, 400]);
    expect(out).toBe(`${CDN}/cdn-cgi/image/w=400,f=auto/a.jpg 400w`);
  });

  it('returns empty string for nullish src', () => {
    expect(buildImageSrcSet(null, [400])).toBe('');
  });
});

describe('buildImagePlaceholder', () => {
  it('produces a small, blurred URL for LQIP', () => {
    const out = buildImagePlaceholder(`${CDN}/a.jpg`);
    expect(out).toContain('w=32');
    expect(out).toContain('blur=60');
    expect(out).toContain('q=40');
  });
});
