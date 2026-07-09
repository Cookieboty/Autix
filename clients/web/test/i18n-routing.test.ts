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
});
