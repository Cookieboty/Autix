/** CF Image Resizing 全站 3 档；一张源图最多 3 次转换费用。 */
export const IMAGE_TIERS = {
  mobile: 640,
  pad: 1024,
  pc: 1920,
} as const;

export const IMAGE_TIER_WIDTHS = [
  IMAGE_TIERS.mobile,
  IMAGE_TIERS.pad,
  IMAGE_TIERS.pc,
] as const;

export const IMAGE_QUALITY = 75;
export const IMAGE_FIT = 'cover' as const;

export type ImageTier = keyof typeof IMAGE_TIERS;

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

function tierOptions(width: number): string {
  return `w=${width},q=${IMAGE_QUALITY},fit=${IMAGE_FIT},f=auto`;
}

function rewrite(src: string, options: string): string {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return src;
  }
  if (!isTransformable(url)) return src;
  const rest = `${url.pathname}${url.search}${url.hash}`.replace(/^\/+/, '');
  return `${url.origin}/cdn-cgi/image/${options}/${rest}`;
}

function passthroughReason(src: string | null | undefined): string | null {
  if (!src) return '';
  if (src.startsWith('data:') || src.startsWith('blob:')) return src;
  if (!/^https?:\/\//i.test(src)) return src;
  return null;
}

/** 返回指定档位的变换 URL。非白名单域 / data: / blob: / 相对路径原样返回。 */
export function buildTieredImageUrl(
  src: string | null | undefined,
  tier: ImageTier = 'pad',
): string {
  const bypass = passthroughReason(src);
  if (bypass !== null) return bypass;
  return rewrite(src as string, tierOptions(IMAGE_TIERS[tier]));
}

/** 生成三档 `srcSet`，形如 `url-640 640w, url-1024 1024w, url-1920 1920w`。 */
export function buildTieredSrcSet(src: string | null | undefined): string {
  const bypass = passthroughReason(src);
  if (bypass !== null) return '';
  return IMAGE_TIER_WIDTHS.map(
    (w) => `${rewrite(src as string, tierOptions(w))} ${w}w`,
  ).join(', ');
}

/**
 * 下载专用：返回原图 URL，不走 CF 变换。已被 /cdn-cgi/image/... 包裹的会被剥回原图。
 */
export function buildOriginalDownloadUrl(src: string | null | undefined): string {
  if (!src) return '';
  const match = src.match(/^(https?:\/\/[^/]+)\/cdn-cgi\/image\/[^/]+\/(.*)$/i);
  if (match) return `${match[1]}/${match[2]}`;
  return src;
}

