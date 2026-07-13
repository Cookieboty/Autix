import { describe, it, expect, beforeAll } from 'vitest';
import { PREFIXED_LOCALES } from '@/i18n/routing';
import { ROUTE_POLICY } from '@/lib/i18n/route-policy';

const { default: robots } = await import('@/app/robots');

const AUTHED_SEGMENTS = [
  'c',
  'chat',
  'draw',
  'library',
  'materials',
  'membership',
  'notifications',
  'profile',
  'resources',
  'workbench',
  'admin',
] as const;

let result: ReturnType<typeof robots>;
let disallow: string[];

// See sitemap.test.ts: `describe` bodies run before `beforeAll` in Vitest, so
// `robots()` (which reads `NEXT_PUBLIC_SITE_URL` at call time) must be
// invoked inside `beforeAll`, not at the `describe` body's top level.
beforeAll(() => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com';
  result = robots();
  const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;
  disallow = Array.isArray(rule?.disallow)
    ? rule.disallow
    : rule?.disallow
      ? [rule.disallow]
      : [];
});

describe('robots', () => {
  it('每个认证段的裸路径与全部 6 个 locale 前缀变体都被 disallow', () => {
    for (const segment of AUTHED_SEGMENTS) {
      expect(disallow).toContain(`/${segment}`);
      expect(disallow).toContain(`/${segment}/`);
      for (const locale of PREFIXED_LOCALES) {
        expect(disallow).toContain(`/${locale}/${segment}`);
        expect(disallow).toContain(`/${locale}/${segment}/`);
      }
    }
  });

  // 私密分享页 /share/ 与 /s/ 【故意】不被 disallow。它们带 noindex meta，而 noindex
  // 只有在 Googlebot 被允许【抓取】页面读到该 meta 时才生效。若 disallow，Google 停抓 →
  // 永远看不到 noindex → 已入索引的 URL 冻结在索引里（"Indexed, though blocked by
  // robots.txt"），正是本次迁移要消除的状态。别把它们加回 disallow。见 app/robots.ts 注释。
  it('私密分享前缀 share / s 及其 locale 变体【绝不能】被 disallow（否则 noindex 失效）', () => {
    for (const segment of ['share', 's'] as const) {
      expect(disallow).not.toContain(`/${segment}/`);
      for (const locale of PREFIXED_LOCALES) {
        expect(disallow).not.toContain(`/${locale}/${segment}/`);
      }
    }
  });

  it('sitemap 字段指向绝对 URL', () => {
    expect(result.sitemap).toBe('https://example.com/sitemap.xml');
  });

  it('full 策略路由不会被误伤', () => {
    const fullPaths = Object.entries(ROUTE_POLICY)
      .filter(([, policy]) => policy.kind === 'full')
      .map(([path]) => path);

    expect(fullPaths.length).toBeGreaterThan(0); // sanity: 确有 full 路由可测

    for (const path of fullPaths) {
      const withTrailingSlash = path.endsWith('/') ? path : `${path}/`;
      const blocked = disallow.some((rule) => withTrailingSlash.startsWith(rule));
      expect(blocked).toBe(false);
    }
  });
});
