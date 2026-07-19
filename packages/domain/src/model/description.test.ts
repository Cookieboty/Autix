import { describe, expect, it } from 'vitest';
import { resolve, dirname } from 'path';
import { readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { resolveDescription, validateDescription, SUPPORTED_LOCALES } from './description';

describe('SUPPORTED_LOCALES', () => {
  // messages 按业务拆 chunk：`messages/<chunk>/<locale>.json`。
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const messagesDir = resolve(__dirname, '../../../i18n/src/messages');
  const LOCALE_FILE = /^[a-z]{2}(-[A-Z]{2})?\.json$/;

  const chunkDirs = readdirSync(messagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const localesIn = (chunk: string) =>
    readdirSync(resolve(messagesDir, chunk))
      .filter((file) => LOCALE_FILE.test(file))
      .map((file) => file.replace(/\.json$/, ''))
      .sort();

  it('ships at least one message chunk', () => {
    // 防空转：读空会让下面的集合比较恒真。
    expect(chunkDirs.length).toBeGreaterThan(0);
  });

  it.each(chunkDirs)('chunk %s ships exactly the SUPPORTED_LOCALES bundles', (chunk) => {
    expect(localesIn(chunk)).toEqual([...SUPPORTED_LOCALES].sort());
  });

  it('has no stray bare-locale bundle left at the messages root', () => {
    // 根目录只应有 docs-layout.en.json 这类带命名空间的文件。
    const strays = readdirSync(messagesDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .filter((entry) => LOCALE_FILE.test(entry.name))
      .map((entry) => entry.name);
    expect(strays).toEqual([]);
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
