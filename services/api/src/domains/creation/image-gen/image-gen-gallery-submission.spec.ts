import {
  buildGallerySubmissionDto,
  deriveAspectRatioFromSize,
  GALLERY_AUTO_SUBMISSION_CATEGORY,
} from './image-gen-gallery-submission';

describe('deriveAspectRatioFromSize (WxH → aspectRatio)', () => {
  it('正方形 1024x1024 → 1:1', () => {
    expect(deriveAspectRatioFromSize('1024x1024')).toBe('1:1');
  });

  it('竖屏 1024x1792 → 4:7（按最大公约数约分）', () => {
    expect(deriveAspectRatioFromSize('1024x1792')).toBe('4:7');
  });

  it('支持 × 分隔符', () => {
    expect(deriveAspectRatioFromSize('1536×1024')).toBe('3:2');
  });

  it('非 WxH 格式 / 空值返回 undefined', () => {
    expect(deriveAspectRatioFromSize('auto')).toBeUndefined();
    expect(deriveAspectRatioFromSize(undefined)).toBeUndefined();
    expect(deriveAspectRatioFromSize(null)).toBeUndefined();
    expect(deriveAspectRatioFromSize('')).toBeUndefined();
  });
});

describe('buildGallerySubmissionDto (公开生成 → 画廊自动投稿映射)', () => {
  it('单图：构造 FROM_GENERATION 投稿 dto，coverImage 取第一张', () => {
    const dto = buildGallerySubmissionDto({
      images: [{ url: 'https://cdn/a.png' }],
      generationId: 'gen-1',
    });
    expect(dto).toEqual({
      kind: 'IMAGE',
      category: GALLERY_AUTO_SUBMISSION_CATEGORY,
      mediaUrls: ['https://cdn/a.png'],
      coverImage: 'https://cdn/a.png',
      sourceType: 'FROM_GENERATION',
      imageGenerationId: 'gen-1',
    });
  });

  it('多图：一条画廊帖子携带所有 url，coverImage 仍取第一张', () => {
    const dto = buildGallerySubmissionDto({
      images: [{ url: 'https://cdn/a.png' }, { url: 'https://cdn/b.png' }],
      generationId: 'gen-2',
      aspectRatio: '1:1',
    });
    expect(dto?.mediaUrls).toEqual(['https://cdn/a.png', 'https://cdn/b.png']);
    expect(dto?.coverImage).toBe('https://cdn/a.png');
    expect(dto?.aspectRatio).toBe('1:1');
  });

  it('无 aspectRatio 时不携带该字段', () => {
    const dto = buildGallerySubmissionDto({
      images: [{ url: 'https://cdn/a.png' }],
      generationId: 'gen-3',
    });
    expect(dto).not.toHaveProperty('aspectRatio');
  });

  it('没有图片时返回 null，调用方应跳过投稿', () => {
    expect(buildGallerySubmissionDto({ images: [], generationId: 'gen-4' })).toBeNull();
  });

  it('缺少 generationId 时返回 null（无法满足 FROM_GENERATION 归属校验）', () => {
    expect(
      buildGallerySubmissionDto({ images: [{ url: 'https://cdn/a.png' }], generationId: undefined }),
    ).toBeNull();
    expect(
      buildGallerySubmissionDto({ images: [{ url: 'https://cdn/a.png' }], generationId: null }),
    ).toBeNull();
  });
});
