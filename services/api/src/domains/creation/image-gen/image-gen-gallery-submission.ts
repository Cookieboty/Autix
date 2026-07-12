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

/** image_generations 中用于快照到 gallery_posts 的字段子集（image/video 生成记录共用）。 */
export interface GenerationSnapshotRecord {
  resolvedPrompt: string;
  modelUsed: string;
  /** video_generations 无 width/height 列，取 undefined/null 均视为未知。 */
  width?: number | null;
  height?: number | null;
  referenceImage: string | null;
}

export interface ReferenceImageAuthorization {
  /** 投稿方（DTO）显式声明允许公开参考图。 */
  allowPublicReference?: boolean;
  /** 参考图本身是否已是站内公开可复用资源（PUBLISHED 画廊 / APPROVED 模板 / 用户自有素材），由调用方查库判定后传入。 */
  referenceImageIsPubliclyReusable?: boolean;
}

export interface GallerySnapshotFields {
  prompt: string;
  model: string;
  width: number | null;
  height: number | null;
  referenceImage: string | null;
}

/**
 * 从生成记录快照画廊投稿的元数据字段（§投稿闭环 Task 4）。
 * prompt/model/width/height 始终来自服务端生成记录，不信任调用方 DTO。
 * referenceImage：仅当 `allowPublicReference === true` 或参考图本身是公开可复用的站内资源
 * (`referenceImageIsPubliclyReusable === true`) 时才快照；否则默认为 null（保守 fail-closed）。
 */
export function snapshotGenerationMetadata(
  generation: GenerationSnapshotRecord,
  authorization: ReferenceImageAuthorization,
): GallerySnapshotFields {
  const referenceImageAuthorized =
    authorization.allowPublicReference === true ||
    authorization.referenceImageIsPubliclyReusable === true;
  return {
    prompt: generation.resolvedPrompt,
    model: generation.modelUsed,
    width: generation.width ?? null,
    height: generation.height ?? null,
    referenceImage: referenceImageAuthorized ? generation.referenceImage : null,
  };
}

/** image_generations.generatedImages / video_generations.generatedVideos 的字段子集。 */
export interface GenerationMediaRecord {
  generatedImages?: string[] | null;
  generatedVideos?: string[] | null;
}

export interface DerivedSubmissionMedia {
  mediaUrls: string[];
  coverImage: string;
}

/**
 * FROM_GENERATION 投稿的 mediaUrls/coverImage 派生（Task 4.5 站内来源守卫）：
 * 完全来自服务端生成记录（generatedImages/generatedVideos），不信任调用方 DTO —— 与
 * Task 4 的 prompt/model/width/height 快照（snapshotGenerationMetadata）保持同一原则。
 * 生成结果为空时返回 null，调用方应视为"无可投稿媒体"直接拒绝（400），而不是静默放行。
 */
export function deriveGenerationMediaUrls(
  record: GenerationMediaRecord,
): DerivedSubmissionMedia | null {
  const urls = record.generatedImages?.length
    ? record.generatedImages
    : record.generatedVideos ?? [];
  if (urls.length === 0) return null;
  return { mediaUrls: urls, coverImage: urls[0] };
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
