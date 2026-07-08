/**
 * 广场作品导入映射：把导入文件（data.json 形态）里"我们要的字段"抽出来，其余丢弃。
 * 约定来源字段：image_url / prompt / model / width / height / tool|content_type（判 kind）。
 * 广场不要标题（title 一律丢弃）；data.json 无 category → 留空。
 */
export type GalleryImportRaw = Record<string, unknown>;

export interface MappedGalleryImport {
  kind: 'IMAGE' | 'VIDEO';
  coverImage: string | null;
  mediaUrls: string[];
  prompt: string | null;
  model: string | null;
  width: number | null;
  height: number | null;
  aspectRatio: string | null;
  category: string;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function int(value: unknown): number | null {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** 由像素宽高算出约分后的长宽比字符串，如 832×1248 → "2:3"。 */
export function aspectRatioOf(width: number, height: number): string {
  const g = gcd(width, height) || 1;
  return `${width / g}:${height / g}`;
}

export function mapGalleryImportItem(raw: GalleryImportRaw): MappedGalleryImport {
  const image = str(raw.image_url) ?? str(raw.coverImage) ?? str(raw.url);
  const width = int(raw.width);
  const height = int(raw.height);
  const tool = str(raw.tool);
  const contentType = str(raw.content_type);
  const kind: 'IMAGE' | 'VIDEO' =
    tool === 'video' || contentType?.startsWith('video/') ? 'VIDEO' : 'IMAGE';

  return {
    kind,
    coverImage: image,
    mediaUrls: image ? [image] : [],
    prompt: str(raw.prompt),
    model: str(raw.model),
    width,
    height,
    aspectRatio:
      width && height ? aspectRatioOf(width, height) : str(raw.aspectRatio),
    // data.json 无 category；标题按要求丢弃（不进 gallery）。
    category: str(raw.category) ?? '',
  };
}
