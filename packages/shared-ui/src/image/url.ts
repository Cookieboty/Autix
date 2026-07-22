/** CF Image Resizing 支持的核心变换参数。字段名与 CF 官方参数一一对应。 */
export interface CfImageTransform {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'auto' | 'avif' | 'webp' | 'jpeg' | 'baseline-jpeg';
  fit?: 'cover' | 'contain' | 'scale-down' | 'crop' | 'pad';
  blur?: number;
  dpr?: number;
  background?: string;
  metadata?: 'keep' | 'copyright' | 'none';
}

const DEFAULT_ALLOWED_HOSTS = ['cdn.amux.ai', 'cdn.amux.test'];

function readEnvHosts(): string[] {
  const raw =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_CDN_IMAGE_HOSTS) || '';
  return raw
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

let allowedHostsCache: Set<string> | null = null;
function getAllowedHosts(): Set<string> {
  if (allowedHostsCache) return allowedHostsCache;
  allowedHostsCache = new Set(
    [...DEFAULT_ALLOWED_HOSTS.map((h) => h.toLowerCase()), ...readEnvHosts()],
  );
  return allowedHostsCache;
}

/** 测试用：覆盖白名单。生产代码不要调用。 */
export function __setAllowedImageHostsForTest(hosts: string[] | null) {
  allowedHostsCache = hosts === null ? null : new Set(hosts.map((h) => h.toLowerCase()));
}

function isTransformable(url: URL): boolean {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  if (url.pathname.startsWith('/cdn-cgi/image/')) return false;
  return getAllowedHosts().has(url.hostname.toLowerCase());
}

function serializeTransform(t: CfImageTransform): string {
  const parts: string[] = [];
  if (t.width) parts.push(`w=${Math.round(t.width)}`);
  if (t.height) parts.push(`h=${Math.round(t.height)}`);
  if (t.quality) parts.push(`q=${Math.max(1, Math.min(100, Math.round(t.quality)))}`);
  if (t.format) parts.push(`f=${t.format}`);
  if (t.fit) parts.push(`fit=${t.fit}`);
  if (t.blur) parts.push(`blur=${Math.max(1, Math.min(250, Math.round(t.blur)))}`);
  if (t.dpr) parts.push(`dpr=${Math.max(1, Math.min(2, t.dpr))}`);
  // 选项以逗号分隔，含逗号的颜色（rgb()/hsl()）会撕裂整个列表，只接受 hex / 颜色名
  if (t.background && !t.background.includes(',')) {
    parts.push(`background=${encodeURIComponent(t.background)}`);
  }
  if (t.metadata) parts.push(`metadata=${t.metadata}`);
  if (!parts.some((p) => p.startsWith('f='))) parts.push('f=auto');
  return parts.join(',');
}

/**
 * 把原图 URL 改写为 CF Image Resizing URL：`${origin}/cdn-cgi/image/${opts}/${rest}`。
 * 非白名单域 / data: / blob: / 相对路径 / 已带 `/cdn-cgi/image/` 前缀的一律原样返回。
 */
export function buildImageUrl(src: string | null | undefined, transform: CfImageTransform = {}): string {
  if (!src) return '';
  if (src.startsWith('data:') || src.startsWith('blob:')) return src;
  if (!/^https?:\/\//i.test(src)) return src;

  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return src;
  }
  if (!isTransformable(url)) return src;

  const options = serializeTransform(transform);
  const rest = `${url.pathname}${url.search}${url.hash}`.replace(/^\/+/, '');
  return `${url.origin}/cdn-cgi/image/${options}/${rest}`;
}

/** 为 `<img srcset>` 生成一串候选源。 */
export function buildImageSrcSet(
  src: string | null | undefined,
  widths: number[],
  transform: Omit<CfImageTransform, 'width'> = {},
): string {
  if (!src) return '';
  return widths
    .filter((w) => Number.isFinite(w) && w > 0)
    .map((w) => `${buildImageUrl(src, { ...transform, width: w })} ${Math.round(w)}w`)
    .join(', ');
}

/** 生成 LQIP 占位图 URL（极小 + 强模糊）。 */
export function buildImagePlaceholder(
  src: string | null | undefined,
  opts: { width?: number; blur?: number; quality?: number } = {},
): string {
  return buildImageUrl(src, {
    width: opts.width ?? 32,
    blur: opts.blur ?? 60,
    quality: opts.quality ?? 40,
    format: 'auto',
  });
}
