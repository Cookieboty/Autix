import { describe, expect, it } from 'vitest';
import { resolveDescription, validateDescription, SUPPORTED_LOCALES } from './description';

describe('SUPPORTED_LOCALES', () => {
  it('matches the locale files shipped by @autix/i18n', () => {
    expect([...SUPPORTED_LOCALES].sort()).toEqual(
      ['en', 'fr', 'ja', 'ru', 'vi', 'zh-CN', 'zh-TW'].sort(),
    );
  });
});

describe('resolveDescription', () => {
  const description = { en: 'Fast image model', 'zh-CN': '快速图片模型' };

  it('returns the requested locale', () => {
    expect(resolveDescription(description, 'zh-CN', 'GPT-Image')).toBe('快速图片模型');
  });

  it('falls back to en when the locale is missing', () => {
    expect(resolveDescription(description, 'ja', 'GPT-Image')).toBe('Fast image model');
  });

  it('falls back to the model name when en is missing too', () => {
    expect(resolveDescription({ ja: 'x' }, 'fr', 'GPT-Image')).toBe('GPT-Image');
  });

  it('falls back to the model name for an empty map', () => {
    expect(resolveDescription({}, 'en', 'GPT-Image')).toBe('GPT-Image');
  });

  it('treats an empty string as missing', () => {
    expect(resolveDescription({ 'zh-CN': '', en: 'Fast' }, 'zh-CN', 'GPT-Image')).toBe('Fast');
  });
});

describe('validateDescription', () => {
  it('accepts a map of supported locales', () => {
    expect(validateDescription({ en: 'a', 'zh-CN': 'b' })).toEqual([]);
  });

  it('accepts an empty map', () => {
    expect(validateDescription({})).toEqual([]);
  });

  it('rejects unsupported locale keys', () => {
    // 运营手滑写 cn / zh 是最可能的错误：前端永远取不到，且不报错。
    expect(validateDescription({ cn: 'a', zh: 'b', en: 'c' }).sort()).toEqual(['cn', 'zh']);
  });

  it('rejects non-string values', () => {
    expect(validateDescription({ en: 123 })).toEqual(['en']);
  });

  it('rejects a non-object', () => {
    expect(validateDescription('hello')).toEqual(['<root>']);
    expect(validateDescription(null)).toEqual(['<root>']);
  });
});
