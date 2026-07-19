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
});
