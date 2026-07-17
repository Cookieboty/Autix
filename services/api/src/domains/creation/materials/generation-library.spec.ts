import { describe, expect, it } from 'vitest';
import {
  buildGenerationMaterialRows,
  buildGenerationSourceId,
  buildGenerationTitle,
} from './generation-library';

describe('buildGenerationSourceId', () => {
  it('带下标，使同一次生成的多张图互不覆盖', () => {
    expect(buildGenerationSourceId('gen-1', 0)).toBe('gen-1::0');
    expect(buildGenerationSourceId('gen-1', 2)).toBe('gen-1::2');
  });
});

describe('buildGenerationTitle', () => {
  it('空 prompt 回退到默认标题', () => {
    expect(buildGenerationTitle('   ', '生成图片')).toBe('生成图片');
  });

  it('压平换行与连续空白', () => {
    expect(buildGenerationTitle('a\n\n  b', '生成图片')).toBe('a b');
  });

  it('超长 prompt 截断到 title 列上限 200', () => {
    const title = buildGenerationTitle('x'.repeat(500), '生成图片');
    expect(title).toHaveLength(200);
    expect(title.endsWith('…')).toBe(true);
  });
});

describe('buildGenerationMaterialRows', () => {
  const base = {
    userId: 'user-1',
    generationId: 'gen-1',
    prompt: 'a cat',
    kind: 'image' as const,
  };

  it('每张图一条素材，sourceId 按下标区分', () => {
    const rows = buildGenerationMaterialRows({
      ...base,
      urls: ['https://cdn/a.png', 'https://cdn/b.png'],
    });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.sourceId)).toEqual(['gen-1::0', 'gen-1::1']);
    expect(rows.every((r) => r.librarySource === 'GENERATION')).toBe(true);
    expect(rows.every((r) => r.userId === 'user-1')).toBe(true);
  });

  it('sourceResourceType 恒为 null——生成物不对应市场资源', () => {
    const rows = buildGenerationMaterialRows({ ...base, urls: ['https://cdn/a.png'] });
    expect(rows[0]!.sourceResourceType).toBeNull();
  });

  it('空 url 被丢弃，且不打乱其余图片的下标', () => {
    const rows = buildGenerationMaterialRows({
      ...base,
      urls: ['https://cdn/a.png', '', 'https://cdn/c.png'],
    });
    expect(rows).toHaveLength(2);
    // 第三张图仍是 ::2，不能因为中间那张失败就滑到 ::1——否则回填与生成写入会对不上。
    expect(rows.map((r) => r.sourceId)).toEqual(['gen-1::0', 'gen-1::2']);
  });

  it('图片用自身做缩略图，视频不猜缩略图', () => {
    const [image] = buildGenerationMaterialRows({ ...base, urls: ['https://cdn/a.png'] });
    expect(image!.thumbnailUrl).toBe('https://cdn/a.png');
    expect(image!.sourceType).toBe('image_generation');

    const [video] = buildGenerationMaterialRows({
      ...base,
      kind: 'video',
      urls: ['https://cdn/a.mp4'],
    });
    expect(video!.thumbnailUrl).toBeNull();
    expect(video!.sourceType).toBe('video_generation');
    expect(video!.type).toBe('video');
  });

  it('沿用生成时间，让素材库与生成流水按同一时间线排序', () => {
    const createdAt = new Date('2026-07-09T10:00:00Z');
    const [row] = buildGenerationMaterialRows({
      ...base,
      urls: ['https://cdn/a.png'],
      createdAt,
    });
    expect(row!.createdAt).toBe(createdAt);
  });
});
