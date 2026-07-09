import { describe, it, expect } from 'vitest';
import { stripLocalePrefix } from '@/lib/locale-path';

describe('stripLocalePrefix', () => {
  it('裸路径原样返回', () => {
    expect(stripLocalePrefix('/community')).toBe('/community');
  });

  it('剥离前缀语言段 /ja/community -> /community', () => {
    expect(stripLocalePrefix('/ja/community')).toBe('/community');
  });

  it('剥离默认语言段 /en/x -> /x', () => {
    expect(stripLocalePrefix('/en/x')).toBe('/x');
  });

  it('首段形似 locale 但不是 locale 时原样返回', () => {
    expect(stripLocalePrefix('/enterprise')).toBe('/enterprise');
  });

  it('仅有语言段本身时归一化为根路径', () => {
    expect(stripLocalePrefix('/ja')).toBe('/');
  });

  it('根路径原样返回', () => {
    expect(stripLocalePrefix('/')).toBe('/');
  });
});
