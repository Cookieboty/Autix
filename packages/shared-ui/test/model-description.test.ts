import { describe, expect, it } from 'vitest';
import { resolveModelDescription } from '../src/growth/generator/model-description';

const withDescription = (description: Record<string, string> | null | undefined) =>
  ({ description }) as Parameters<typeof resolveModelDescription>[0];

describe('resolveModelDescription', () => {
  const bilingual = { en: 'ByteDance Seedream image model', 'zh-CN': '字节 Seedream 图像模型' };

  it('命中当前语种', () => {
    expect(resolveModelDescription(withDescription(bilingual), 'zh-CN')).toBe(
      '字节 Seedream 图像模型',
    );
    expect(resolveModelDescription(withDescription(bilingual), 'en')).toBe(
      'ByteDance Seedream image model',
    );
  });

  it('同语系回退：zh-TW 没有单独文案时用 zh-CN，而不是直接掉到英文', () => {
    expect(resolveModelDescription(withDescription(bilingual), 'zh-TW')).toBe(
      '字节 Seedream 图像模型',
    );
  });

  it('语种缺失回退到 en', () => {
    expect(resolveModelDescription(withDescription(bilingual), 'ja')).toBe(
      'ByteDance Seedream image model',
    );
  });

  it('连 en 都没有时取任意一条非空', () => {
    expect(resolveModelDescription(withDescription({ ja: '画像モデル' }), 'fr')).toBe('画像モデル');
  });

  it('运营没填（库里就是 {}）→ undefined，调用方不渲染那一行', () => {
    expect(resolveModelDescription(withDescription({}), 'zh-CN')).toBeUndefined();
    expect(resolveModelDescription(withDescription(null), 'zh-CN')).toBeUndefined();
    expect(resolveModelDescription(withDescription(undefined), 'zh-CN')).toBeUndefined();
  });

  it('空串不算有效文案（否则界面上是一行空白）', () => {
    expect(resolveModelDescription(withDescription({ 'zh-CN': '   ', en: 'fallback' }), 'zh-CN')).toBe(
      'fallback',
    );
  });

  /** 绝不回退到模型 id —— 那正是这次要从界面上拿掉的东西。 */
  it('取不到文案时返回 undefined，不会拿模型 id 顶上', () => {
    expect(resolveModelDescription(withDescription({}), 'en')).toBeUndefined();
  });
});
