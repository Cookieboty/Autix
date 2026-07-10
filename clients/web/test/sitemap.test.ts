import { describe, it, expect, beforeAll } from 'vitest';

const { default: sitemap, buildSitemapEntries } = await import('@/app/sitemap');

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

  it('条目数达到（注入的）上限时抛出，而非静默截断', () => {
    // 生产环境下 50000 条目遥不可及，无法在测试里真的撑出这么多条目来触发
    // throw；因此把上限作为参数注入 `buildSitemapEntries`，让当前 ~30 条的
    // entries 数量轻松越过一个人为调低的阈值，从而真正执行到 throw 分支
    // ——而不是仅仅断言"数量 < 50000"这类恒真命题。生产默认值（50_000）
    // 未被弱化：`buildSitemapEntries()`（无参数）与默认导出的 `sitemap()`
    // 仍然使用真实的 MAX_ENTRIES。
    expect(() => buildSitemapEntries(1)).toThrow(/sitemap entry count \d+ is approaching/);
  });

  // --- Finding 2: 除 origin 根外，任何 sitemap URL 都不得以 "/" 结尾（否则提交重定向 URL） ---

  it('除 origin 根 https://example.com/ 外，无 URL 以 "/" 结尾', () => {
    const offenders = urls.filter(
      (u) => u.endsWith('/') && u !== 'https://example.com/',
    );
    expect(offenders).toEqual([]);
  });

  it('六个本地化首页 URL 为 /zh-CN /zh-TW /fr /ja /ru /vi（无尾斜杠）', () => {
    for (const locale of ['zh-CN', 'zh-TW', 'fr', 'ja', 'ru', 'vi']) {
      expect(urls).toContain(`https://example.com/${locale}`);
      expect(urls).not.toContain(`https://example.com/${locale}/`);
    }
  });
});
