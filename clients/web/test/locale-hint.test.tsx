import { describe, it, expect, vi } from 'vitest';

// @/i18n/navigation 在模块加载时会 createNavigation(routing)；只测纯函数，桩掉即可，
// 避免拉入 next 运行时依赖。
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/',
  getPathname: () => '/',
}));

const { isHintDismissed, suggestionForRoute } = await import('@/components/LocaleHint');

describe('isHintDismissed（正确解析 cookie，非子串匹配）', () => {
  it('精确的 locale-hint-dismissed=1 命中', () => {
    expect(isHintDismissed('locale-hint-dismissed=1')).toBe(true);
    expect(isHintDismissed('foo=bar; locale-hint-dismissed=1; baz=2')).toBe(true);
  });

  it('值为 10 不应命中（旧子串实现会误判）', () => {
    expect(isHintDismissed('locale-hint-dismissed=10')).toBe(false);
  });

  it('前缀不同的键名不应命中（旧子串实现会误判）', () => {
    expect(isHintDismissed('not-locale-hint-dismissed=1')).toBe(false);
  });

  it('无 cookie / 未设置时为 false', () => {
    expect(isHintDismissed('')).toBe(false);
    expect(isHintDismissed('other=1')).toBe(false);
  });
});

describe('suggestionForRoute（只建议该路由确实服务的 locale）', () => {
  it('partial 路由 /docs：非声明 locale（ja）不建议', () => {
    expect(suggestionForRoute('/docs', 'ja')).toBeNull();
  });

  it('partial 路由 /docs：声明的 zh-CN 可建议', () => {
    expect(suggestionForRoute('/docs', 'zh-CN')).toBe('zh-CN');
  });

  it('full 路由 /pricing：任意 locale 可建议', () => {
    expect(suggestionForRoute('/pricing', 'ja')).toBe('ja');
  });

  it('neutral 路由 /u/alice：任意 locale 可建议（壳已译）', () => {
    expect(suggestionForRoute('/u/alice', 'ja')).toBe('ja');
  });

  it('未知路由：不建议（返回 null）', () => {
    expect(suggestionForRoute('/totally/unknown', 'ja')).toBeNull();
  });
});
