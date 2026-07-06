import type { ClipboardEvent as ReactClipboardEvent } from 'react';
import type { DrawElement } from './draw-scene-mapper';
import type { AppStateLike, CopiedCanvasImage } from './draw-types';
import { drawElementToImageRef, hasImageUrl } from './draw-image-helpers';

export function isEditablePasteTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('textarea,input,select,[contenteditable="true"]'));
}

export function isCanvasPasteContext(target: EventTarget | null, canvasRoot: HTMLElement | null): boolean {
  if (!canvasRoot || typeof document === 'undefined') return false;
  if (target instanceof Element && canvasRoot.contains(target)) return true;

  const active = document.activeElement;
  if (active === document.body || active === document.documentElement) return true;
  return active instanceof Element && canvasRoot.contains(active);
}

export function canCreateCanvasPasteElement(clipboardData: DataTransfer | null): boolean {
  if (!clipboardData || hasExcalidrawClipboardData(clipboardData)) return false;
  return (
    getClipboardImageFiles(clipboardData).length > 0 ||
    Boolean(getClipboardImageUrl(clipboardData)) ||
    Boolean(getClipboardPlainText(clipboardData))
  );
}

export function getClipboardImageFiles(clipboardData: DataTransfer | null): File[] {
  return Array.from(clipboardData?.files ?? []).filter((file) => file.type.startsWith('image/'));
}

export function getClipboardImageUrl(clipboardData: DataTransfer | null): string | null {
  if (!clipboardData) return null;
  const html = clipboardData.getData('text/html');
  if (html) {
    const fromHtml = imageSrcFromHtml(html);
    if (fromHtml) return fromHtml;
  }
  for (const type of ['text/uri-list', 'text/plain']) {
    const value = clipboardData.getData(type).trim();
    if (isLikelyImageTextUrl(value)) return value;
  }
  return null;
}

function imageSrcFromHtml(html: string): string | null {
  if (typeof DOMParser === 'undefined') return null;
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const rawSrc = doc.querySelector('img[src]')?.getAttribute('src')?.trim();
    const src = absoluteClipboardUrl(rawSrc ?? '');
    return isLikelyImageSrc(src ?? '') ? src ?? null : null;
  } catch {
    return null;
  }
}

function absoluteClipboardUrl(value: string): string {
  if (!value || /^data:/i.test(value) || /^https?:\/\//i.test(value)) return value;
  try {
    return new URL(value, window.location.href).toString();
  } catch {
    return value;
  }
}

function isLikelyImageSrc(value: string): boolean {
  if (!value) return false;
  if (/^data:image\//i.test(value)) return true;
  if (!/^https?:\/\//i.test(value)) return false;
  return true;
}

function isLikelyImageTextUrl(value: string): boolean {
  if (!value) return false;
  if (/^data:image\//i.test(value)) return true;
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    return /\.(png|jpe?g|webp|gif|bmp|avif|tiff?)(?:$|[?#])/i.test(new URL(value).pathname);
  } catch {
    return false;
  }
}

export function getClipboardPlainText(clipboardData: DataTransfer): string {
  const text = clipboardData.getData('text/plain').trim();
  return isLikelyExcalidrawClipboardText(text) ? '' : text;
}

export function isLikelyExcalidrawClipboardText(text: string): boolean {
  if (!text || text.length < 2) return false;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== 'object') return false;
    const record = parsed as Record<string, unknown>;
    if (record.type === 'excalidraw/clipboard' || record.type === 'excalidraw') return true;
    if (Array.isArray(record.elements)) {
      return record.elements.some((item) => (
        item &&
        typeof item === 'object' &&
        typeof (item as { type?: unknown }).type === 'string'
      ));
    }
    return false;
  } catch {
    return false;
  }
}

export function imageLabelFromUrl(url: string): string {
  if (url.startsWith('data:')) return 'Pasted image';
  try {
    const pathname = new URL(url).pathname;
    const name = decodeURIComponent(pathname.split('/').filter(Boolean).pop() ?? '');
    return name || 'Pasted image';
  } catch {
    return 'Pasted image';
  }
}

export function hasExcalidrawClipboardData(clipboardData: DataTransfer): boolean {
  return (
    Array.from(clipboardData.types).some((type) => type.toLowerCase().includes('excalidraw')) ||
    isLikelyExcalidrawClipboardText(clipboardData.getData('text/plain').trim())
  );
}

export function getCopiedCanvasImagesFromClipboard(clipboardData: DataTransfer): CopiedCanvasImage[] | null {
  for (const type of Array.from(clipboardData.types)) {
    const value = clipboardData.getData(type);
    const images = copiedCanvasImagesFromJson(value);
    if (images?.length) return images;
  }
  return null;
}

export function copiedCanvasImagesFromJson(value: string): CopiedCanvasImage[] | null {
  if (!value.trim()) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    const elements = extractClipboardElements(parsed);
    if (!elements?.length) return null;
    const copiedElements = elements.filter((element) => !element.isDeleted);
    if (copiedElements.length === 0 || copiedElements.some((element) => element.type !== 'image')) return null;
    const images = copiedElements
      .map((element) => drawElementToImageRef(element, 'Pasted image'))
      .filter(hasImageUrl)
      .map((image) => ({
        url: image.url,
        label: image.label,
        x: image.x,
        y: image.y,
        width: image.width,
        height: image.height,
      }));
    return images.length > 0 ? images : null;
  } catch {
    return null;
  }
}

function extractClipboardElements(value: unknown): DrawElement[] | null {
  if (Array.isArray(value)) return value.filter(isClipboardDrawElement);
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.elements)) return record.elements.filter(isClipboardDrawElement);
  const data = record.data;
  if (data && typeof data === 'object' && Array.isArray((data as { elements?: unknown }).elements)) {
    return (data as { elements: unknown[] }).elements.filter(isClipboardDrawElement);
  }
  return null;
}

function isClipboardDrawElement(value: unknown): value is DrawElement {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof (value as { id?: unknown }).id === 'string' &&
    typeof (value as { type?: unknown }).type === 'string',
  );
}

export function pastePositionFromEvent(event: ReactClipboardEvent<HTMLDivElement>, appState: AppStateLike): { x: number; y: number } {
  return defaultPastePosition(appState, event.currentTarget.getBoundingClientRect());
}

export function defaultPastePosition(appState: AppStateLike, rect?: DOMRect): { x: number; y: number } {
  const zoom = appState.zoom?.value ?? 1;
  const scrollX = appState.scrollX ?? 0;
  const scrollY = appState.scrollY ?? 0;
  const screenX = rect ? rect.width * 0.5 : 360;
  const screenY = rect ? rect.height * 0.42 : 220;
  return {
    x: Math.round(screenX / zoom - scrollX),
    y: Math.round(screenY / zoom - scrollY),
  };
}

export function longestLineLength(value: string): number {
  return value.split(/\r?\n/).reduce((max, line) => Math.max(max, line.length), 0);
}
