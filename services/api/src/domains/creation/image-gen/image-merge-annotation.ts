import { HttpStatus } from '@nestjs/common';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import sharp = require('sharp');
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';

const MERGE_IMAGE_TIMEOUT_MS = 15_000;
const MAX_MERGE_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_MERGE_IMAGE_PIXELS = 16_000_000;
const MAX_MERGE_IMAGE_DIMENSION = 8192;
const MAX_MERGE_IMAGE_REDIRECTS = 3;
const MERGE_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

// 图像标注合成流程里所有面向用户的 4xx 错误都要走 i18n 通道：
// 该文件被图像上传/标注入口直接调用，任何 throw 都会成为终端用户可见的响应
// message。旧实现直接用 `new BadRequestException('图片…')` 让非中文用户永远
// 看到中文；改用 I18nHttpException + creation.image_merge.* 词条后按 req.lang
// 翻译，仍返回 400 语义，err code 保持 BAD_REQUEST 以兼容前端已有分支。
function badImageMergeError(key: string, args?: Record<string, unknown>) {
  return new I18nHttpException(HttpStatus.BAD_REQUEST, key, args, {
    code: 'BAD_REQUEST',
  });
}

export function optionalUrlHostname(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

export function allowedMergeImageHostnames() {
  return new Set(
    [
      'cdn.amux.ai',
      optionalUrlHostname(process.env.DOMAIN),
    ].filter((host): host is string => Boolean(host)),
  );
}

export function imageDataUrlToBuffer(value: string): Buffer {
  const match = /^data:image\/([a-z0-9.+-]+);base64,(.+)$/i.exec(value);
  if (!match) throw badImageMergeError('creation.image_merge.invalid_data_format');
  const subtype = match[1].toLowerCase() === 'jpg' ? 'jpeg' : match[1].toLowerCase();
  const mimeType = `image/${subtype}`;
  if (!MERGE_IMAGE_MIME_TYPES.has(mimeType)) {
    throw badImageMergeError('creation.image_merge.unsupported_format');
  }
  const base64 = match[2];
  if (Math.floor((base64.length * 3) / 4) > MAX_MERGE_IMAGE_BYTES) {
    throw badImageMergeError('creation.image_merge.image_too_large');
  }
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.byteLength > MAX_MERGE_IMAGE_BYTES) {
    throw badImageMergeError('creation.image_merge.image_too_large');
  }
  return buffer;
}

export function isPrivateIpAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 0) return false;
  if (version === 6) {
    const normalized = address.toLowerCase();
    return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80');
  }
  const parts = address.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

async function assertSafeImageUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw badImageMergeError('creation.image_merge.invalid_url');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw badImageMergeError('creation.image_merge.unsupported_protocol');
  }
  const hostname = url.hostname.toLowerCase();
  if (!allowedMergeImageHostnames().has(hostname)) {
    throw badImageMergeError('creation.image_merge.forbidden_host');
  }
  if (hostname === 'localhost' || hostname.endsWith('.local') || isPrivateIpAddress(hostname)) {
    throw badImageMergeError('creation.image_merge.forbidden_host');
  }
  const records = await lookup(hostname, { all: true, verbatim: true }).catch(() => {
    throw badImageMergeError('creation.image_merge.dns_unresolved');
  });
  if (records.some((record) => isPrivateIpAddress(record.address))) {
    throw badImageMergeError('creation.image_merge.forbidden_host');
  }
}

async function readResponseBuffer(res: globalThis.Response): Promise<Buffer> {
  const contentType = res.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (contentType && !MERGE_IMAGE_MIME_TYPES.has(contentType)) {
    throw badImageMergeError('creation.image_merge.content_type_not_image');
  }
  const contentLength = Number(res.headers.get('content-length') ?? 0);
  if (contentLength > MAX_MERGE_IMAGE_BYTES) {
    throw badImageMergeError('creation.image_merge.image_too_large');
  }

  if (!res.body) {
    const fallback = Buffer.from(await res.arrayBuffer());
    if (fallback.byteLength > MAX_MERGE_IMAGE_BYTES) {
      throw badImageMergeError('creation.image_merge.image_too_large');
    }
    return fallback;
  }

  const reader = res.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_MERGE_IMAGE_BYTES) {
      throw badImageMergeError('creation.image_merge.image_too_large');
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

async function readImageBuffer(value: string): Promise<Buffer> {
  if (/^data:image\//i.test(value)) return imageDataUrlToBuffer(value);

  let currentUrl = value;
  for (let redirects = 0; redirects <= MAX_MERGE_IMAGE_REDIRECTS; redirects += 1) {
    await assertSafeImageUrl(currentUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MERGE_IMAGE_TIMEOUT_MS);
    try {
      const res = await fetch(currentUrl, { signal: controller.signal, redirect: 'manual' });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location || redirects === MAX_MERGE_IMAGE_REDIRECTS) {
          throw badImageMergeError('creation.image_merge.redirect_unavailable');
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }
      if (!res.ok) throw badImageMergeError('creation.image_merge.fetch_failed', { status: res.status });
      return await readResponseBuffer(res);
    } finally {
      clearTimeout(timer);
    }
  }
  throw badImageMergeError('creation.image_merge.redirect_unavailable');
}

export async function mergeAnnotationDataUrls(
  imageUrl: string,
  overlayDataUrl: string,
): Promise<string> {
  const imageBuffer = await readImageBuffer(imageUrl);
  const overlayBuffer = imageDataUrlToBuffer(overlayDataUrl);
  const sharpOptions = {
    failOn: 'none' as const,
    limitInputPixels: MAX_MERGE_IMAGE_PIXELS,
  };
  const normalizedImage = await sharp(imageBuffer, sharpOptions)
    .rotate()
    .png()
    .toBuffer();
  const metadata = await sharp(normalizedImage, sharpOptions).metadata();
  if (!metadata.width || !metadata.height) {
    throw badImageMergeError('creation.image_merge.metadata_unreadable');
  }
  if (
    metadata.width > MAX_MERGE_IMAGE_DIMENSION ||
    metadata.height > MAX_MERGE_IMAGE_DIMENSION ||
    metadata.width * metadata.height > MAX_MERGE_IMAGE_PIXELS
  ) {
    throw badImageMergeError('creation.image_merge.dimension_too_large');
  }
  const overlay = await sharp(overlayBuffer, sharpOptions)
    .resize(metadata.width, metadata.height, { fit: 'fill' })
    .png()
    .toBuffer();
  const merged = await sharp(normalizedImage, sharpOptions)
    .composite([{ input: overlay, blend: 'over' }])
    .png()
    .toBuffer();
  if (merged.byteLength > MAX_MERGE_IMAGE_BYTES) {
    throw badImageMergeError('creation.image_merge.image_too_large');
  }

  return `data:image/png;base64,${merged.toString('base64')}`;
}
