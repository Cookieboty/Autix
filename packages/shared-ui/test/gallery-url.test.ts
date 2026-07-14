import { describe, expect, it } from 'vitest';
import {
  GALLERY_TAB_PATH,
  buildStudioSearch,
  galleryPostPath,
  parseStudioMode,
} from '../src/growth/generator/image/gallery-url';

describe('parseStudioMode', () => {
  it('无参数 → 历史 Tab（页面默认）', () => {
    expect(parseStudioMode('')).toBe('history');
  });

  it('?mode=gallery → 广场 Tab', () => {
    expect(parseStudioMode('?mode=gallery')).toBe('gallery');
  });

  it('旧的 ?mode=templates 不再认（Tab 已改名，不留双写）', () => {
    expect(parseStudioMode('?mode=templates')).toBe('history');
  });
});

describe('buildStudioSearch', () => {
  it('广场 Tab → 写入 mode', () => {
    expect(buildStudioSearch('', 'gallery')).toBe('?mode=gallery');
  });

  it('历史 Tab → 清掉 mode', () => {
    expect(buildStudioSearch('?mode=gallery', 'history')).toBe('');
  });

  it('保留其它 query（?model= / ?prompt= 是别的功能在用，不能被顺手删掉）', () => {
    const next = buildStudioSearch('?model=gpt-image-2&prompt=hi', 'gallery');
    const params = new URLSearchParams(next);
    expect(params.get('model')).toBe('gpt-image-2');
    expect(params.get('prompt')).toBe('hi');
    expect(params.get('mode')).toBe('gallery');
  });

  it('历史 Tab 且无其它 query → 空串，不留一个光秃秃的 "?"', () => {
    expect(buildStudioSearch('?mode=gallery', 'history')).toBe('');
  });
});

describe('galleryPostPath', () => {
  it('作品详情是独立路由，不是生成器上的 query', () => {
    expect(galleryPostPath('abc')).toBe('/gallery/abc');
  });

  it('id 做 URL 编码', () => {
    expect(galleryPostPath('a b&c')).toBe('/gallery/a%20b%26c');
  });
});

describe('GALLERY_TAB_PATH', () => {
  it('作品详情页点关闭时回到广场 Tab（而不是默认的历史 Tab）', () => {
    expect(GALLERY_TAB_PATH).toBe('/ai/image?mode=gallery');
  });
});
