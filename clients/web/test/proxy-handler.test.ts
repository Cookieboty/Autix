import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { resolveProxyAction } from '@/lib/proxy-handler';
import { routing } from '@/i18n/routing';

const API = 'http://api.internal:4000';

describe('resolveProxyAction', () => {
  it('/api/* 直接反代，绕过 intl', () => {
    expect(resolveProxyAction('/api/users', '?a=1', API)).toEqual({
      type: 'rewrite',
      url: 'http://api.internal:4000/api/users?a=1',
    });
  });

  it('裸 @handle → rewrite 到 /<默认locale>/u/<handle>', () => {
    expect(resolveProxyAction('/@alice', '', API)).toEqual({
      type: 'rewrite',
      url: '/en/u/alice',
    });
  });

  it('带前缀 @handle → rewrite 保留该 locale 段', () => {
    expect(resolveProxyAction('/ja/@alice', '', API)).toEqual({
      type: 'rewrite',
      url: '/ja/u/alice',
    });
  });

  // `/en/*` 统一是显式英文出口：去前缀之外还要把 cookie 钉成 en，否则客户端
  // hydrate 会回落到 localStorage 里的旧偏好，把用户拽回中文。cookie 已是 en 时
  // 才退化为可缓存的 301。详见 test/locale-stickiness.test.ts。
  it('默认 locale 前缀的 @handle 去前缀并钉住英文', () => {
    expect(resolveProxyAction('/en/@alice', '', API)).toEqual({
      type: 'redirect',
      url: '/@alice',
      status: 302,
      setLocaleCookie: 'en',
    });
  });

  it('默认 locale 前缀的 @handle + cookie en → 301 纯规范化', () => {
    expect(resolveProxyAction('/en/@alice', '', API, 'en')).toEqual({
      type: 'redirect',
      url: '/@alice',
      status: 301,
    });
  });

  it('@handle 带子路径时不匹配，交给 intl', () => {
    expect(resolveProxyAction('/@alice/posts', '', API)).toEqual({ type: 'intl' });
  });

  it('其余路径交给 intl', () => {
    expect(resolveProxyAction('/pricing', '', API)).toEqual({ type: 'intl' });
    expect(resolveProxyAction('/zh-CN/pricing', '', API)).toEqual({ type: 'intl' });
  });

  it('查询串在 @handle 上随 rewrite 一并透传', () => {
    expect(resolveProxyAction('/@alice', '?ref=x', API)).toEqual({
      type: 'rewrite',
      url: '/en/u/alice?ref=x',
    });
  });

  it('带点号的 /api 路径也应反代（matcher 需放行，此处 pin 纯函数行为）', () => {
    expect(resolveProxyAction('/api/download/report.pdf', '', API)).toEqual({
      type: 'rewrite',
      url: 'http://api.internal:4000/api/download/report.pdf',
    });
  });

  it('裸 @handle 含点号 → rewrite（handle 允许点号，如邮箱型）', () => {
    expect(resolveProxyAction('/@john.doe', '', API)).toEqual({
      type: 'rewrite',
      url: '/en/u/john.doe',
    });
  });

  it('带前缀 @handle 含点号 → rewrite 保留 locale', () => {
    expect(resolveProxyAction('/ja/@john.doe', '', API)).toEqual({
      type: 'rewrite',
      url: '/ja/u/john.doe',
    });
  });

  it('默认 locale 前缀 @handle 含点号同样去前缀并钉住英文', () => {
    expect(resolveProxyAction('/en/@john.doe', '', API)).toEqual({
      type: 'redirect',
      url: '/@john.doe',
      status: 302,
      setLocaleCookie: 'en',
    });
  });

  // Finding 7: `.` / `..` handle 会被 new URL() 规范化成首页（/en/u/.. → /en/），一律拒绝，交给 intl
  it('handle 为 ".." 不 rewrite，交给 intl（否则被规范化为首页）', () => {
    expect(resolveProxyAction('/@..', '', API)).toEqual({ type: 'intl' });
  });

  it('handle 为 "." 不 rewrite，交给 intl', () => {
    expect(resolveProxyAction('/@.', '', API)).toEqual({ type: 'intl' });
  });

  it('带前缀的 ".." handle 也交给 intl', () => {
    expect(resolveProxyAction('/ja/@..', '', API)).toEqual({ type: 'intl' });
  });

  it('默认 locale 前缀的 ".." handle 不 301，交给 intl', () => {
    expect(resolveProxyAction('/en/@..', '', API)).toEqual({ type: 'intl' });
  });

  // Finding 7: matcher 放行裸 /api，handler 也须反代它（决定：反代，使二者一致）
  it('裸 /api 也反代（matcher 放行，handler 对齐）', () => {
    expect(resolveProxyAction('/api', '?a=1', API)).toEqual({
      type: 'rewrite',
      url: 'http://api.internal:4000/api?a=1',
    });
  });
});

describe('resolveProxyAction — 根路径按 NEXT_LOCALE cookie 自动跳转', () => {
  it('/ + cookie zh-CN → 302 跳转 /zh-CN', () => {
    expect(resolveProxyAction('/', '', API, 'zh-CN')).toEqual({
      type: 'redirect',
      url: '/zh-CN',
      status: 302,
    });
  });

  it('/ + cookie ja → 302 跳转 /ja', () => {
    expect(resolveProxyAction('/', '', API, 'ja')).toEqual({
      type: 'redirect',
      url: '/ja',
      status: 302,
    });
  });

  it('/ + cookie en（默认 locale）→ 不跳转，交给 intl', () => {
    expect(resolveProxyAction('/', '', API, 'en')).toEqual({ type: 'intl' });
  });

  it('/ + 无 cookie → 不跳转，交给 intl（Googlebot / 首次访问）', () => {
    expect(resolveProxyAction('/', '', API)).toEqual({ type: 'intl' });
  });

  it('/ + 非法/不支持的 cookie 值 → 不跳转，交给 intl', () => {
    expect(resolveProxyAction('/', '', API, 'xx-garbage')).toEqual({ type: 'intl' });
  });

  // 契约已变更：裸深链接不再"保持裸路径"，而是按接收者的 cookie 跳到他自己的语言。
  // 链接依然可分享（各人看各自语言），换来的是 locale 粘性可以在边缘被强制。
  // 完整不变量见 test/locale-stickiness.test.ts。
  it('/pricing + cookie zh-CN → 302 捞回中文（locale 粘性优先于裸路径）', () => {
    expect(resolveProxyAction('/pricing', '', API, 'zh-CN')).toEqual({
      type: 'redirect',
      url: '/zh-CN/pricing',
      status: 302,
    });
  });

  it('/zh-CN + cookie zh-CN → 不跳转（不形成循环）', () => {
    expect(resolveProxyAction('/zh-CN', '', API, 'zh-CN')).toEqual({ type: 'intl' });
  });

  it('/zh-CN + cookie ja → 不跳转（URL 优先于 cookie）', () => {
    expect(resolveProxyAction('/zh-CN', '', API, 'ja')).toEqual({ type: 'intl' });
  });

  it('/?utm=x + cookie ja → 302 跳转 /ja?utm=x（保留查询串）', () => {
    expect(resolveProxyAction('/', '?utm=x', API, 'ja')).toEqual({
      type: 'redirect',
      url: '/ja?utm=x',
      status: 302,
    });
  });
});

describe('proxy.ts matcher / routing 同步', () => {
  // next 要求 config.matcher 在 build 期静态可分析，不能从 proxy.ts 里 `import { config }`
  // 做运行期比对：next-intl/middleware 在 vitest 下解析 next/server 会直接报模块找不到
  // （已验证：`Cannot find module '.../node_modules/next/server' imported from
  // next-intl/dist/.../middleware.js`）。所以这里退化为读取 proxy.ts 源码文本，
  // 用正则把 matcher 里手写的 locale 字面量抠出来，和 routing.locales 做集合比对，
  // 防止两处 locale 列表漂移。
  function readMatcherLocales(): string[] {
    const source = readFileSync(path.resolve(__dirname, '../proxy.ts'), 'utf8');
    const match = source.match(/\/:locale\(([^)]+)\)/);
    if (!match) {
      throw new Error('proxy.ts 的 matcher 中未找到 `/:locale(...)` 形式的 locale 字面量');
    }
    return match[1].split('|');
  }

  it('matcher 里手写的 locale 字面量与 routing.locales 完全一致（含默认 locale en）', () => {
    const matcherLocales = readMatcherLocales().slice().sort();
    const routingLocales = [...routing.locales].sort();
    expect(matcherLocales).toEqual(routingLocales);
    expect(matcherLocales).toContain('en');
    expect(matcherLocales).toHaveLength(7);
  });
});
