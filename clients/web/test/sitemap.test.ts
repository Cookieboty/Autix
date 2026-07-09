import { describe, it, expect, beforeAll } from 'vitest';

const { default: sitemap } = await import('@/app/sitemap');

let entries: ReturnType<typeof sitemap>;
let urls: string[];

// NOTE: `entries`/`urls` are computed inside `beforeAll`, not at the
// `describe` body's top level. Vitest runs a file's `describe` bodies
// (collection) to completion *before* any `beforeAll` hook fires, so calling
// `sitemap()` directly in the `describe` body would read
// `NEXT_PUBLIC_SITE_URL` before this hook sets it, silently falling back to
// `http://localhost:3100`.
beforeAll(() => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com';
  entries = sitemap();
  urls = entries.map((e) => e.url);
});

describe('sitemap', () => {
  it('包含 full 路由的裸路径与 6 个前缀变体', () => {
    expect(urls).toContain('https://example.com/pricing');
    expect(urls).toContain('https://example.com/ja/pricing');
    expect(urls).toContain('https://example.com/zh-CN/pricing');
    expect(urls).not.toContain('https://example.com/en/pricing'); // 默认语言不带前缀
  });

  it('partial 路由只出声明的语言', () => {
    expect(urls).toContain('https://example.com/docs');
    expect(urls).toContain('https://example.com/zh-CN/docs');
    expect(urls).not.toContain('https://example.com/ja/docs');
  });

  it('neutral 路由只出裸路径', () => {
    expect(urls).toContain('https://example.com/community');
    expect(urls).not.toContain('https://example.com/ja/community');
  });

  it('noindex 路由完全不出现', () => {
    expect(urls.some((u) => u.includes('/share/video'))).toBe(false);
    expect(urls.some((u) => u.includes('/admin'))).toBe(false);
    expect(urls.some((u) => u.includes('/login'))).toBe(false);
  });

  it('不含任何未解析的动态段模板串', () => {
    expect(urls.filter((u) => u.includes('[') || u.includes(']'))).toEqual([]);
  });

  it('条目数远低于 Next 的 50000 上限', () => {
    expect(entries.length).toBeLessThan(50_000);
  });
});
