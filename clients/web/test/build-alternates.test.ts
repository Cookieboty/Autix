import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(() => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com';
});

const { buildAlternates } = await import('@/lib/i18n/build-alternates');

describe('buildAlternates', () => {
  it('full：7 语 hreflang + x-default 指向裸路径，全为绝对 URL', () => {
    const { alternates } = buildAlternates('/pricing');
    expect(alternates!.canonical).toBe('https://example.com/pricing');
    const langs = alternates!.languages as Record<string, string>;
    expect(langs.en).toBe('https://example.com/pricing');
    expect(langs['zh-CN']).toBe('https://example.com/zh-CN/pricing');
    expect(langs.ja).toBe('https://example.com/ja/pricing');
    expect(langs['x-default']).toBe('https://example.com/pricing');
    expect(Object.keys(langs)).toHaveLength(8); // 7 语 + x-default
  });

  it('partial：仅声明的语言进 hreflang', () => {
    const { alternates } = buildAlternates('/docs');
    const langs = alternates!.languages as Record<string, string>;
    expect(Object.keys(langs).sort()).toEqual(['en', 'x-default', 'zh-CN']);
    expect(langs['zh-CN']).toBe('https://example.com/zh-CN/docs');
  });

  it('neutral：canonical 恒指裸路径，不发 hreflang', () => {
    const { alternates } = buildAlternates('/marketplace/[type]/[id]', {
      type: 'image-templates',
      id: 'abc',
    });
    expect(alternates!.canonical).toBe(
      'https://example.com/marketplace/image-templates/abc',
    );
    expect(alternates!.languages).toBeUndefined();
  });

  it('noindex：私密分享页不进索引', () => {
    const { robots, alternates } = buildAlternates('/share/video/[token]', {
      token: 't1',
    });
    expect(robots).toEqual({ index: false, follow: false });
    expect(alternates!.languages).toBeUndefined();
  });

  it('未声明的路由直接抛错（防止新增页漏 hreflang）', () => {
    expect(() => buildAlternates('/not-declared')).toThrow(/ROUTE_POLICY/);
  });
});
