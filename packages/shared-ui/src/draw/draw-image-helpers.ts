import type { DrawElement } from './draw-scene-mapper';
import { DEFAULT_IMAGE_SIZE } from './draw-constants';
import type { CanvasImageRef } from './draw-types';

export function hasImageUrl(image: { url: string }): boolean {
  return image.url.trim().length > 0;
}

export function drawElementToImageRef(el: DrawElement, fallbackLabel: string): CanvasImageRef {
  const rawAssetUrl = el.customData?.assetUrl;
  const assetUrl = typeof rawAssetUrl === 'string' ? rawAssetUrl.trim() : '';
  return {
    elementId: el.id,
    url: assetUrl,
    label: typeof el.customData?.label === 'string' && el.customData.label ? el.customData.label : fallbackLabel,
    x: Number(el.x) || 0,
    y: Number(el.y) || 0,
    width: Math.round(Number(el.width) || DEFAULT_IMAGE_SIZE),
    height: Math.round(Number(el.height) || DEFAULT_IMAGE_SIZE),
  };
}

export function dataUrlToFile(dataURL: string, name: string): File {
  const [header = '', payload = ''] = dataURL.split(',');
  const mimeType = header.match(/^data:([^;]+)/)?.[1] ?? 'image/png';
  if (header.includes(';base64')) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], name, { type: mimeType });
  }
  return new File([decodeURIComponent(payload)], name, { type: mimeType });
}

export function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('file-read-failed'));
    reader.readAsDataURL(file);
  });
}

export async function toExcalidrawDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    return await readFileAsDataUrl(await res.blob());
  } catch {
    return url;
  }
}

/** Read an image's intrinsic pixel dimensions (0x0 if it fails to decode). */
export function measureImage(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = src;
  });
}

export function fitWithinBox(
  natural: { width: number; height: number },
  max: number,
): { width: number; height: number } {
  const { width, height } = natural;
  if (!(width > 0) || !(height > 0)) return { width: max, height: max };
  const scale = max / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function downloadUrl(url: string, filename: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noreferrer';
  anchor.target = '_blank';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
