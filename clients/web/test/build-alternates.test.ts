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

  // --- Finding 1: canonical 必须随 locale 自指向（full / partial），neutral / noindex 例外 ---

  it('full + fr：canonical 自指向当前 locale，languages 仍是全 7 语 + x-default', () => {
    const { alternates } = buildAlternates('/pricing', undefined, 'fr');
    expect(alternates!.canonical).toBe('https://example.com/fr/pricing');
    const langs = alternates!.languages as Record<string, string>;
    expect(Object.keys(langs)).toHaveLength(8);
    expect(langs['x-default']).toBe('https://example.com/pricing');
  });

  it('full + en（默认语言）：canonical 落回裸路径', () => {
    const { alternates } = buildAlternates('/pricing', undefined, 'en');
    expect(alternates!.canonical).toBe('https://example.com/pricing');
  });

  it('partial + zh-CN：canonical 同样自指向当前 locale', () => {
    const { alternates } = buildAlternates('/docs', undefined, 'zh-CN');
    expect(alternates!.canonical).toBe('https://example.com/zh-CN/docs');
  });

  it('neutral + ja：canonical 仍收敛到裸路径，不随 locale 变化', () => {
    const { alternates } = buildAlternates(
      '/marketplace/[type]/[id]',
      { type: 'image-templates', id: 'abc' },
      'ja',
    );
    expect(alternates!.canonical).toBe(
      'https://example.com/marketplace/image-templates/abc',
    );
  });

  // --- Finding 2/3: fillParams 必须转义单段参数，catch-all 按段转义后用 / 重新拼接 ---

  it('单段参数中的 "/" 被转义，不产生额外路径段', () => {
    const { alternates } = buildAlternates('/share/video/[token]', { token: 'a/b' });
    expect(alternates!.canonical).toBe('https://example.com/share/video/a%2Fb');
  });

  it('单段参数中的 "?" 被转义，不被解析成查询串', () => {
    const { alternates } = buildAlternates('/share/video/[token]', { token: 'a?x=1' });
    expect(alternates!.canonical).toBe('https://example.com/share/video/a%3Fx%3D1');
  });

  it('单段参数中的 "#" 被转义，不被解析成 fragment', () => {
    const { alternates } = buildAlternates('/share/video/[token]', { token: 'ab#frag' });
    expect(alternates!.canonical).toBe('https://example.com/share/video/ab%23frag');
  });

  it('catch-all 参数按 "/" 拆段各自转义后重新拼接，段结构保留', () => {
    const { alternates } = buildAlternates('/docs/[...slug]', {
      slug: 'guides/getting-started',
    });
    expect(alternates!.canonical).toBe(
      'https://example.com/docs/guides/getting-started',
    );
    const langs = alternates!.languages as Record<string, string>;
    expect(Object.keys(langs).sort()).toEqual(['en', 'x-default', 'zh-CN']);
    expect(langs['zh-CN']).toBe(
      'https://example.com/zh-CN/docs/guides/getting-started',
    );
  });
});
