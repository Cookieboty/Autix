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

  it('裸 @handle 补默认 locale 段（否则物理路由 404）', () => {
    expect(resolveProxyAction('/@alice', '', API)).toEqual({
      type: 'rewrite',
      url: '/en/u/alice',
    });
  });

  it('带前缀 @handle 保留该 locale', () => {
    expect(resolveProxyAction('/ja/@alice', '', API)).toEqual({
      type: 'rewrite',
      url: '/ja/u/alice',
    });
  });

  it('默认 locale 前缀的 @handle 需 301 去前缀', () => {
    expect(resolveProxyAction('/en/@alice', '', API)).toEqual({
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

  it('查询串在 @handle rewrite 中保留', () => {
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

  it('裸 @handle 含点号', () => {
    expect(resolveProxyAction('/@john.doe', '', API)).toEqual({
      type: 'rewrite',
      url: '/en/u/john.doe',
    });
  });

  it('带前缀 @handle 含点号', () => {
    expect(resolveProxyAction('/ja/@john.doe', '', API)).toEqual({
      type: 'rewrite',
      url: '/ja/u/john.doe',
    });
  });

  it('默认 locale 前缀 @handle 含点号需 301 去前缀', () => {
    expect(resolveProxyAction('/en/@john.doe', '', API)).toEqual({
      type: 'redirect',
      url: '/@john.doe',
      status: 301,
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
