import { describe, it, expect } from 'vitest';
import { routing, PREFIXED_LOCALES } from '@/i18n/routing';

describe('routing 配置', () => {
  it('默认 locale 为 en', () => {
    expect(routing.defaultLocale).toBe('en');
  });

  it('7 种语言全部登记', () => {
    expect([...routing.locales].sort()).toEqual(
      ['en', 'fr', 'ja', 'ru', 'vi', 'zh-CN', 'zh-TW'].sort(),
    );
  });

  it('前缀 locale 恰为 6 个且不含 en', () => {
    expect(PREFIXED_LOCALES).toHaveLength(6);
    expect(PREFIXED_LOCALES).not.toContain('en');
  });

  it('as-needed 前缀，且关闭自动语言协商与自动 hreflang', () => {
    expect(routing.localePrefix).toBe('as-needed');
    expect(routing.localeDetection).toBe(false);
    expect(routing.alternateLinks).toBe(false);
  });

  it('必须关闭 next-intl 的自动 NEXT_LOCALE 写入', () => {
    // 打开的话 next-intl 会在每个响应上写 NEXT_LOCALE，把「用户从未选过语言」
    // 伪造成「用户选了英文」：首访裸路径立刻得到 NEXT_LOCALE=en，代理的 cookie
    // 兜底与 resolveLanguage 的优先级链都被这个假信号压死，localStorage 里真实的
    // 中文偏好永远赢不了（实测症状：中文用户首访裸路径恒定落英文）。
    // NEXT_LOCALE 必须只由语言切换器和代理的显式英文出口写入。
    expect(routing.localeCookie).toBe(false);
  });
});
