import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadLocaleTree } from './locale-loader';

describe('loadLocaleTree', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'locales-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('读取单层目录下的 yaml，按文件名作为语言码', () => {
    writeFileSync(join(dir, 'en.yaml'), 'a.b: "Hello"\n');
    const tree = loadLocaleTree(dir);
    expect(tree.get('en')).toEqual({ 'a.b': 'Hello' });
  });

  it('递归读取子目录，并把同一语言的多个文件合并成一张扁平表', () => {
    mkdirSync(join(dir, 'identity'));
    mkdirSync(join(dir, 'billing'));
    writeFileSync(join(dir, 'identity', 'en.yaml'), 'auth.denied: "Denied"\n');
    writeFileSync(join(dir, 'billing', 'en.yaml'), 'points.low: "Low"\n');

    const tree = loadLocaleTree(dir);

    expect(tree.get('en')).toEqual({
      'auth.denied': 'Denied',
      'points.low': 'Low',
    });
  });

  it('分别归并不同语言', () => {
    mkdirSync(join(dir, 'identity'));
    writeFileSync(join(dir, 'identity', 'en.yaml'), 'auth.denied: "Denied"\n');
    writeFileSync(join(dir, 'identity', 'zh-CN.yaml'), 'auth.denied: "拒绝访问"\n');

    const tree = loadLocaleTree(dir);

    expect(tree.get('en')).toEqual({ 'auth.denied': 'Denied' });
    expect(tree.get('zh-CN')).toEqual({ 'auth.denied': '拒绝访问' });
  });

  it('目录不存在时返回空表而不是抛异常', () => {
    expect(loadLocaleTree(join(dir, 'nope')).size).toBe(0);
  });

  it('空 yaml 文件产生空字典而不是 null', () => {
    writeFileSync(join(dir, 'en.yaml'), '');
    expect(loadLocaleTree(dir).get('en')).toEqual({});
  });

  it('同一语言的两个子目录文件出现重复 key 时抛出异常，而不是静默覆盖', () => {
    mkdirSync(join(dir, 'identity'));
    mkdirSync(join(dir, 'billing'));
    writeFileSync(join(dir, 'identity', 'en.yaml'), 'auth.denied: "Denied"\n');
    writeFileSync(join(dir, 'billing', 'en.yaml'), 'auth.denied: "Duplicate"\n');

    expect(() => loadLocaleTree(dir)).toThrow(/auth\.denied/);
  });

  it('七种 API locale 都包含 Chat Dashboard 的三个错误契约', () => {
    const tree = loadLocaleTree(join(__dirname, 'locales'));
    const locales = ['zh-CN', 'zh-TW', 'en', 'fr', 'ja', 'ru', 'vi'];
    const keys = [
      'admin.chat_dashboard.invalid_range',
      'admin.chat_dashboard.invalid_timezone',
      'auth.system.not_in_chat_system',
    ];

    for (const locale of locales) {
      const messages = tree.get(locale);
      expect(messages, `missing locale ${locale}`).toBeDefined();
      for (const key of keys) {
        expect(messages?.[key], `${locale}:${key}`).toEqual(expect.any(String));
        expect(messages?.[key].trim(), `${locale}:${key}`).not.toBe('');
      }
    }
  });
});
