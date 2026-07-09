import { describe, it, expect, beforeAll } from 'vitest';
import { PREFIXED_LOCALES } from '@/i18n/routing';
import { ROUTE_POLICY } from '@/lib/i18n/route-policy';

const { default: robots } = await import('@/app/robots');

const AUTHED_SEGMENTS = [
  'arena',
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

const PRIVATE_SHARE_SEGMENTS = ['share', 's'] as const;

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
      expect(disallow).toContain(`/${segment}/`);
      for (const locale of PREFIXED_LOCALES) {
        expect(disallow).toContain(`/${locale}/${segment}/`);
      }
    }
  });

  it('私密分享前缀 share / s 及其 locale 变体也被 disallow', () => {
    for (const segment of PRIVATE_SHARE_SEGMENTS) {
      expect(disallow).toContain(`/${segment}/`);
      for (const locale of PREFIXED_LOCALES) {
        expect(disallow).toContain(`/${locale}/${segment}/`);
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
