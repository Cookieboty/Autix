import { describe, it, expect } from 'vitest';
import { resolveProxyAction } from '@/lib/proxy-handler';

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
});
