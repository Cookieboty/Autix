import { describe, it, expect } from 'vitest';
import { DEFAULT_LANGUAGE, FALLBACK_LANGUAGE, SUPPORTED_LANGUAGES } from '@autix/i18n';

describe('i18n 默认语言常量', () => {
  it('默认语言为 en（裸路径语言）', () => {
    expect(DEFAULT_LANGUAGE).toBe('en');
  });

  it('默认语言必须在支持列表内', () => {
    expect(SUPPORTED_LANGUAGES).toContain(DEFAULT_LANGUAGE);
  });

  it('兜底语言与默认语言一致（兜底链已塌缩为一级，见 spec §7.3）', () => {
    expect(FALLBACK_LANGUAGE).toBe(DEFAULT_LANGUAGE);
  });
});
