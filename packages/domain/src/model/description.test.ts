import { describe, expect, it } from 'vitest';
import { resolve, dirname } from 'path';
import { readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { resolveDescription, validateDescription, SUPPORTED_LOCALES } from './description';

describe('SUPPORTED_LOCALES', () => {
  it('matches the locale files shipped by @autix/i18n', () => {
    // Resolve the path relative to this test file's location
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const messagesDir = resolve(__dirname, '../../../i18n/src/messages');

    // Only top-level locale bundles count. The directory also holds
    // namespaced bundles like `docs-layout.en.json`, whose basename is
    // `docs-layout.en` — not a locale. Match `en` / `zh-CN` shapes only.
    const LOCALE_FILE = /^[a-z]{2}(-[A-Z]{2})?\.json$/;

    const localeFiles = readdirSync(messagesDir)
      .filter((file) => LOCALE_FILE.test(file))
      .map((file) => file.replace(/\.json$/, ''))
      .sort();

    // Guard against silently empty directory listings — an empty list would
    // make the comparison below vacuously interesting rather than protective.
    expect(localeFiles.length).toBeGreaterThan(0);

    // And guard against the regex quietly swallowing everything: any file that
    // looks like a locale bundle but is not matched would be invisible here.
    const namespaced = readdirSync(messagesDir).filter(
      (file) => file.endsWith('.json') && !LOCALE_FILE.test(file),
    );
    for (const file of namespaced) {
      expect(file, `${file} must be a namespaced bundle, not a bare locale`).toContain('.');
      expect(file.split('.').length).toBeGreaterThan(2);
    }

    // Compare in both directions: tuple must match files exactly
    const supportedLocales = [...SUPPORTED_LOCALES].sort();
    expect(supportedLocales).toEqual(localeFiles);
    expect(localeFiles).toEqual(supportedLocales);
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

  it('rejects an array', () => {
    expect(validateDescription([])).toEqual(['<root>']);
  });

  it('rejects a number primitive', () => {
    expect(validateDescription(42)).toEqual(['<root>']);
  });
});
