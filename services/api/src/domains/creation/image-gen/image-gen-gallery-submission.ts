/**
 * 私密/公开 → 画廊自动投稿的纯映射逻辑（不依赖 Nest/Prisma，便于单测）。
 * 公开生成 = "先审后发"：workbench 生成成功后自动构造 PENDING 投稿 dto。
 */

export const GALLERY_AUTO_SUBMISSION_CATEGORY = 'ai_generated';

export interface GallerySubmissionSourceImage {
  url: string;
}

export interface GallerySubmissionDto {
  kind: 'IMAGE';
  category: string;
  mediaUrls: string[];
  coverImage: string;
  aspectRatio?: string;
  sourceType: 'FROM_GENERATION';
  imageGenerationId: string;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * 从 "宽x高" 形式的 size（如 "1024x1792"）推导画廊 aspectRatio（如 "9:16"）。
 * 解析失败（非 WxH 格式 / 非正整数）时返回 undefined，调用方应跳过该字段。
 */
export function deriveAspectRatioFromSize(size: string | undefined | null): string | undefined {
  if (!size) return undefined;
  const match = /^(\d+)\s*[x×]\s*(\d+)$/i.exec(size.trim());
  if (!match) return undefined;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return undefined;
  }
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
}

/**
 * 将 workbench 生成结果映射为画廊投稿 dto。
 * 多图只投一条画廊帖子，coverImage 取第一张。
 * 返回 null 表示没有可投稿的图片（调用方应跳过投稿，而不是抛错）。
 */
export function buildGallerySubmissionDto(input: {
  images: GallerySubmissionSourceImage[];
  generationId: string | null | undefined;
  aspectRatio?: string;
}): GallerySubmissionDto | null {
  const urls = input.images.map((image) => image.url).filter((url): url is string => !!url);
  if (urls.length === 0 || !input.generationId) return null;

  return {
    kind: 'IMAGE',
    category: GALLERY_AUTO_SUBMISSION_CATEGORY,
    mediaUrls: urls,
    coverImage: urls[0],
    ...(input.aspectRatio ? { aspectRatio: input.aspectRatio } : {}),
    sourceType: 'FROM_GENERATION',
    imageGenerationId: input.generationId,
  };
}
