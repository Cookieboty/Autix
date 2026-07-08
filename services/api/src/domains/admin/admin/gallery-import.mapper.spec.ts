import { aspectRatioOf, mapGalleryImportItem } from './gallery-import.mapper';

describe('mapGalleryImportItem (data.json 形态)', () => {
  const sample = {
    source: 'krea',
    source_id: '7d316b9d',
    image_url: 'https://gen.krea.ai/images/7d316b9d.png',
    content_type: 'image/png',
    prompt: 'vast frozen polar landscape',
    title: 'vast frozen polar landscape, sculpted white ice',
    model: 'gpt-image-2',
    width: 832,
    height: 1248,
    tool: 'image',
    bytes: 1279936,
  };

  it('只抽取需要的字段：image_url→cover/media、prompt、model、width、height', () => {
    const m = mapGalleryImportItem(sample);
    expect(m.kind).toBe('IMAGE');
    expect(m.coverImage).toBe('https://gen.krea.ai/images/7d316b9d.png');
    expect(m.mediaUrls).toEqual(['https://gen.krea.ai/images/7d316b9d.png']);
    expect(m.prompt).toBe('vast frozen polar landscape');
    expect(m.model).toBe('gpt-image-2');
    expect(m.width).toBe(832);
    expect(m.height).toBe(1248);
  });

  it('丢弃标题及其它无关字段（结果里不含 title/source/bytes）', () => {
    const m = mapGalleryImportItem(sample) as unknown as Record<string, unknown>;
    expect(m.title).toBeUndefined();
    expect(m.source).toBeUndefined();
    expect(m.bytes).toBeUndefined();
  });

  it('由宽高算出约分长宽比 832×1248 → 2:3', () => {
    expect(mapGalleryImportItem(sample).aspectRatio).toBe('2:3');
    expect(aspectRatioOf(1024, 1024)).toBe('1:1');
    expect(aspectRatioOf(1920, 1080)).toBe('16:9');
  });

  it('category 缺省为空串（data.json 无 category）', () => {
    expect(mapGalleryImportItem(sample).category).toBe('');
  });

  it('video：tool=video 或 content_type=video/* 判为 VIDEO', () => {
    expect(mapGalleryImportItem({ ...sample, tool: 'video' }).kind).toBe('VIDEO');
    expect(mapGalleryImportItem({ ...sample, tool: undefined, content_type: 'video/mp4' }).kind).toBe(
      'VIDEO',
    );
  });

  it('缺 image_url 时 coverImage=null、mediaUrls=[]，非法宽高归 null', () => {
    const m = mapGalleryImportItem({ prompt: 'x', width: 0, height: -1 });
    expect(m.coverImage).toBeNull();
    expect(m.mediaUrls).toEqual([]);
    expect(m.width).toBeNull();
    expect(m.height).toBeNull();
    expect(m.aspectRatio).toBeNull();
  });
});
