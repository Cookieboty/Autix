import { describe, it, expect } from 'vitest';
import { resolveLanguage } from '../src/language-resolution';

/**
 * 语言有三个来源：URL 前缀、NEXT_LOCALE cookie、localStorage。
 * 三者可能互相矛盾，必须有唯一的优先级，且胜出者要回写另外两个，否则会出现
 * 「页面英文、选择器中文」这类错位。
 *
 * 优先级：URL 前缀 > cookie > localStorage。
 * 理由：URL 最显式（用户点了本地化链接，或代理刚刚判定过）；cookie 是服务端/代理
 * 唯一能看见并据以决策的东西，绝不能被 localStorage 静默覆盖，否则两端永久失配；
 * localStorage 是最后的持久化兜底（也是 desktop 唯一的来源）。
 */
describe('resolveLanguage', () => {
  describe('URL 前缀最高优先', () => {
    it('URL 是非默认 locale → 胜出，并回写 cookie；stored 有值但错位时同步纠正', () => {
      expect(resolveLanguage({ urlLocale: 'zh-CN', cookie: 'ja', stored: 'fr' })).toEqual({
        language: 'zh-CN',
        writeCookie: 'zh-CN',
        writeStored: 'zh-CN',
      });
    });

    it('URL 是非默认 locale 且 stored 缺失 → 只回写 cookie，不主动写 stored', () => {
      expect(resolveLanguage({ urlLocale: 'zh-CN' })).toEqual({
        language: 'zh-CN',
        writeCookie: 'zh-CN',
      });
    });
  });

  describe('裸路径（URL 为默认 locale）时由 cookie 决定', () => {
    it('cookie=en → 英文胜出，回写 localStorage 消除错位', () => {
      // 场景：用户访问 /en/pricing，代理 302 到裸路径并把 cookie 改成 en。
      // 若此时仍让 localStorage 的旧中文胜出，就会出现「英文页面、中文选项」。
      expect(resolveLanguage({ urlLocale: 'en', cookie: 'en', stored: 'zh-CN' })).toEqual({
        language: 'en',
        writeStored: 'en',
      });
    });

    it('cookie 非默认但 URL 是裸路径 → 采信 cookie，但不切 URL', () => {
      // 只可能发生在 locale 中立路由（/oauth/*）上：代理刻意没捞。
      // 语言状态诚实反映 cookie，但不能去动这类端点的 URL。
      expect(resolveLanguage({ urlLocale: 'en', cookie: 'zh-CN', stored: 'zh-CN' })).toEqual({
        language: 'zh-CN',
      });
    });
  });

  describe('无 cookie 时回落 localStorage，并把 URL 切过去', () => {
    it('localStorage 中文、cookie 缺失、裸路径 → 切 URL 到中文', () => {
      // 代理当时没有 cookie 可依据，所以放行了裸路径（= 英文 SSR）。
      // 客户端补上 cookie 之后必须把 URL 也切过去，否则页面停在英文而选择器显示中文。
      expect(resolveLanguage({ urlLocale: 'en', cookie: undefined, stored: 'zh-CN' })).toEqual({
        language: 'zh-CN',
        writeCookie: 'zh-CN',
        switchUrlTo: 'zh-CN',
      });
    });

    it('localStorage 也是默认语言 → 什么都不用做', () => {
      expect(resolveLanguage({ urlLocale: 'en', cookie: undefined, stored: 'en' })).toEqual({
        language: 'en',
      });
    });

    it('三者全空 → 默认语言', () => {
      expect(resolveLanguage({})).toEqual({ language: 'en' });
    });
  });

  describe('environment 兜底（用户从未手动设置过语言）', () => {
    it('cookie 与 stored 都空、environment=zh-CN、裸路径 → 采信环境语言并切 URL、只回写 cookie', () => {
      expect(resolveLanguage({ urlLocale: 'en', environment: 'zh-CN' })).toEqual({
        language: 'zh-CN',
        writeCookie: 'zh-CN',
        switchUrlTo: 'zh-CN',
      });
    });

    it('desktop 首装无偏好、environment=ja → 用环境语言，只回写 cookie，不落 stored', () => {
      expect(resolveLanguage({ environment: 'ja' })).toEqual({
        language: 'ja',
        writeCookie: 'ja',
      });
    });

    it('environment=en（等于默认语言）→ 不回写，避免给爬虫种 cookie', () => {
      expect(resolveLanguage({ urlLocale: 'en', environment: 'en' })).toEqual({ language: 'en' });
    });

    it('stored 存在时 environment 被忽略（用户已手动设置过）', () => {
      expect(resolveLanguage({ urlLocale: 'en', stored: 'fr', environment: 'zh-CN' })).toEqual({
        language: 'fr',
        writeCookie: 'fr',
        switchUrlTo: 'fr',
      });
    });

    it('cookie 存在但 stored 缺失时 environment 被忽略，仍以 cookie 为准；stored 不主动写', () => {
      expect(resolveLanguage({ urlLocale: 'en', cookie: 'ja', environment: 'zh-CN' })).toEqual({
        language: 'ja',
      });
    });

    it('非法 environment 值被忽略，回落 DEFAULT_LANGUAGE', () => {
      expect(resolveLanguage({ urlLocale: 'en', environment: 'xx-garbage' })).toEqual({
        language: 'en',
      });
    });

    it('稳态：cookie 已落地、stored 仍空、environment 相同 → 完全 no-op', () => {
      expect(resolveLanguage({ urlLocale: 'en', cookie: 'zh-CN', environment: 'zh-CN' })).toEqual({
        language: 'zh-CN',
      });
    });
  });

  describe('不可信输入', () => {
    it('非法 cookie 值被忽略，回落 localStorage', () => {
      expect(resolveLanguage({ urlLocale: 'en', cookie: 'xx-garbage', stored: 'ja' })).toEqual({
        language: 'ja',
        writeCookie: 'ja',
        switchUrlTo: 'ja',
      });
    });

    it('非法 localStorage 值被忽略', () => {
      expect(resolveLanguage({ urlLocale: 'en', stored: 'nope' })).toEqual({ language: 'en' });
    });
  });

  describe('desktop（无 URL locale）', () => {
    it('无 urlLocale → cookie 优先于 localStorage，且不产生 URL 切换', () => {
      const r = resolveLanguage({ cookie: 'ja', stored: 'zh-CN' });
      expect(r.language).toBe('ja');
      expect(r.switchUrlTo).toBeUndefined();
    });

    it('无 urlLocale 且无 cookie → 用 localStorage，不产生 URL 切换', () => {
      const r = resolveLanguage({ stored: 'zh-CN' });
      expect(r.language).toBe('zh-CN');
      expect(r.switchUrlTo).toBeUndefined();
    });
  });
});
