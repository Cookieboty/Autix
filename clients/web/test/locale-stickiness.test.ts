import { describe, it, expect } from 'vitest';
import { resolveProxyAction } from '@/lib/proxy-handler';

const API = 'http://api.internal:4000';

/**
 * 不变量：用户一旦选定非默认语言（NEXT_LOCALE cookie），任何裸路径访问都必须
 * 被捞回该语言，而不是渲染英文。
 *
 * `as-needed` 下裸路径 == 英文，所以「掉了 locale 前缀」和「切成英文」是同一件事。
 * 这类丢失来源很多且无法在调用点逐个杜绝（router 未绑定时的硬跳、
 * window.location.assign、OAuth 回跳、以及以后新写的代码），因此不变量必须由
 * 中间件在边缘统一兜底 —— 这是唯一能覆盖「未来才写出来的 bug」的层。
 *
 * 对称地，`/en/*` 是「我就是要英文」的显式出口，它必须能覆盖已存的 cookie，
 * 否则用户会被自己的旧偏好锁死在中文里（也就是死循环的真正来源）。
 */
describe('locale 粘性不变量', () => {
  describe('裸深链接 + 非默认 cookie → 捞回该语言', () => {
    it('/pricing + cookie zh-CN → 302 /zh-CN/pricing', () => {
      expect(resolveProxyAction('/pricing', '', API, 'zh-CN')).toEqual({
        type: 'redirect',
        url: '/zh-CN/pricing',
        status: 302,
      });
    });

    it('/login + cookie zh-CN → 302 /zh-CN/login（401 跳登录页是最常见的丢失路径）', () => {
      expect(resolveProxyAction('/login', '', API, 'zh-CN')).toEqual({
        type: 'redirect',
        url: '/zh-CN/login',
        status: 302,
      });
    });

    it('多级路径也捞：/ai/video + cookie ja → 302 /ja/ai/video', () => {
      expect(resolveProxyAction('/ai/video', '', API, 'ja')).toEqual({
        type: 'redirect',
        url: '/ja/ai/video',
        status: 302,
      });
    });

    it('查询串保留：/ai/video?projectId=x + cookie zh-CN', () => {
      expect(resolveProxyAction('/ai/video', '?projectId=x', API, 'zh-CN')).toEqual({
        type: 'redirect',
        url: '/zh-CN/ai/video?projectId=x',
        status: 302,
      });
    });
  });

  describe('不捞的情况', () => {
    it('已带 locale 前缀 → 不动（URL 优先于 cookie，且防循环）', () => {
      expect(resolveProxyAction('/zh-CN/pricing', '', API, 'ja')).toEqual({ type: 'intl' });
    });

    it('cookie 是默认 locale → 不动', () => {
      expect(resolveProxyAction('/pricing', '', API, 'en')).toEqual({ type: 'intl' });
    });

    it('无 cookie → 不动（Googlebot / 首访必须看到请求的 URL）', () => {
      expect(resolveProxyAction('/pricing', '', API)).toEqual({ type: 'intl' });
    });

    it('非法 cookie 值 → 不动（不可信输入）', () => {
      expect(resolveProxyAction('/pricing', '', API, 'xx-garbage')).toEqual({ type: 'intl' });
    });

    // 回归：OAuth 回调是注册给第三方的机器端点（redirect URI 恒为 `${origin}/oauth/callback`，
    // 见 lib/oauth-popup-flow.ts:40），必须始终在默认 locale 下渲染。一旦被捞成
    // /zh-CN/oauth/callback，页面里的 intl router 就从 passthrough 变成主动加前缀，
    // 而 consumeOAuthReturnTo() 刻意返回带前缀的 returnTo（/ja/community），
    // 于是产生 /zh-CN/ja/community 这类双前缀 404。
    // 详见 app/[locale]/oauth/callback/page.tsx:25-41 的不变量说明。
    it('/oauth/callback + cookie zh-CN → 不捞（locale 中立端点）', () => {
      expect(resolveProxyAction('/oauth/callback', '?code=x', API, 'zh-CN')).toEqual({
        type: 'intl',
      });
    });

    it('/oauth/popup-callback + cookie zh-CN → 不捞', () => {
      expect(resolveProxyAction('/oauth/popup-callback', '?code=x', API, 'zh-CN')).toEqual({
        type: 'intl',
      });
    });

    it('/api/* 不受影响', () => {
      expect(resolveProxyAction('/api/users', '', API, 'zh-CN')).toEqual({
        type: 'rewrite',
        url: 'http://api.internal:4000/api/users',
      });
    });
  });

  describe('/en/* 是显式英文出口，可覆盖已存 cookie', () => {
    it('/en/pricing + cookie zh-CN → 302 裸路径并改写 cookie 为 en', () => {
      expect(resolveProxyAction('/en/pricing', '', API, 'zh-CN')).toEqual({
        type: 'redirect',
        url: '/pricing',
        status: 302,
        setLocaleCookie: 'en',
      });
    });

    it('/en/pricing + 无 cookie → 也必须写 cookie（冲突可能藏在 localStorage）', () => {
      // 不写的话：客户端 hydrate 发现无 cookie，回落到 localStorage 里的旧中文，
      // 又把用户拽回 /zh-CN/pricing，显式英文意图丢失。
      expect(resolveProxyAction('/en/pricing', '', API)).toEqual({
        type: 'redirect',
        url: '/pricing',
        status: 302,
        setLocaleCookie: 'en',
      });
    });

    it('/en/pricing + cookie en → 301 纯规范化（cookie 已正确，可被缓存）', () => {
      expect(resolveProxyAction('/en/pricing', '', API, 'en')).toEqual({
        type: 'redirect',
        url: '/pricing',
        status: 301,
      });
    });

    it('跳完之后不再被捞回中文（无循环）', () => {
      // 上一条 302 已把 cookie 改成 en，此时再进裸路径不应再跳。
      expect(resolveProxyAction('/pricing', '', API, 'en')).toEqual({ type: 'intl' });
    });
  });

  describe('@handle 虚荣链接跟随 cookie 语言', () => {
    it('/@alice + cookie zh-CN → rewrite 到 /zh-CN/u/alice', () => {
      expect(resolveProxyAction('/@alice', '', API, 'zh-CN')).toEqual({
        type: 'rewrite',
        url: '/zh-CN/u/alice',
        cookieDependent: true,
      });
    });

    it('/@alice + 无 cookie → rewrite 到默认 locale', () => {
      expect(resolveProxyAction('/@alice', '', API)).toEqual({
        type: 'rewrite',
        url: '/en/u/alice',
      });
    });
  });
});
