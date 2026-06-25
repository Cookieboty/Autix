import { describe, it, expect } from 'vitest';
import { flattenLeaves, unflatten, mergeLocaleSets } from '../merge-locales.core';

describe('flattenLeaves / unflatten', () => {
  it('往返无损：嵌套对象 ⇄ 扁平 key-value', () => {
    const nested = { a: { b: '1', c: '2' }, d: '3' };
    const expectedFlat = { 'a.b': '1', 'a.c': '2', d: '3' };

    const flat = flattenLeaves(nested);
    expect(flat).toEqual(expectedFlat);

    const roundTrip = unflatten(flat);
    expect(roundTrip).toEqual(nested);
  });
});

describe('mergeLocaleSets - 并集 + web 优先 + 冲突记录', () => {
  it('合并后含三者、shared 取 web 值、report.conflicts 含该冲突', () => {
    const result = mergeLocaleSets({
      langs: ['zh-CN'],
      defaultLang: 'zh-CN',
      web: {
        'zh-CN': {
          only_web: 'web_value',
          shared: 'web_shared',
        },
      },
      desktop: {
        'zh-CN': {
          only_desktop: 'desktop_value',
          shared: 'desktop_shared',
        },
      },
    });

    const { merged, report } = result;

    // 合并后含三者
    expect(merged['zh-CN']).toMatchObject({
      only_web: 'web_value',
      only_desktop: 'desktop_value',
      shared: 'web_shared', // web 优先
    });

    // 冲突记录
    expect(report.conflicts).toHaveLength(1);
    expect(report.conflicts[0]).toEqual({
      lang: 'zh-CN',
      key: 'shared',
      web: 'web_shared',
      desktop: 'desktop_shared',
    });
  });
});

describe('mergeLocaleSets - 跨语言对齐', () => {
  it('en 合并后的叶子 key 集合必须与 zh-CN 完全一致', () => {
    const result = mergeLocaleSets({
      langs: ['zh-CN', 'en'],
      defaultLang: 'zh-CN',
      web: {
        'zh-CN': {
          only_web: 'web_value',
          shared: 'web_shared',
        },
        en: {
          // en 缺少 only_web 和 shared
        },
      },
      desktop: {
        'zh-CN': {
          only_desktop: 'desktop_value',
          shared: 'desktop_shared',
        },
        en: {
          // en 也缺少 only_desktop 和 shared
        },
      },
    });

    const { merged } = result;

    // 使用 flattenLeaves 比较两种语言的叶子 key 集合
    const enKeys = Object.keys(flattenLeaves(merged['en'])).sort();
    const zhKeys = Object.keys(flattenLeaves(merged['zh-CN'])).sort();

    expect(enKeys).toEqual(zhKeys);
  });
});

describe('mergeLocaleSets - 真实缺失补占位', () => {
  it('zh-CN 有 greet，en 为空时，en.greet === zh-CN 值，且 filled 记录正确', () => {
    const result = mergeLocaleSets({
      langs: ['zh-CN', 'en'],
      defaultLang: 'zh-CN',
      web: {
        'zh-CN': { greet: '你好' },
        en: {},
      },
      desktop: {
        'zh-CN': {},
        en: {},
      },
    });

    const { merged, report } = result;

    // en.greet 应该等于 zh-CN 的值（fallback）
    expect((merged['en'] as Record<string, unknown>)['greet']).toBe('你好');

    // report.filled 应该含有该条记录
    expect(report.filled).toContainEqual({
      lang: 'en',
      key: 'greet',
      source: 'zh-CN-fallback',
    });
  });
});
