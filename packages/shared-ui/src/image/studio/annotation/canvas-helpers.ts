import type { PointerEvent } from 'react';
import {
  mergeAnnotationBounds,
  type AnnotationBounds,
} from '../constants';

export interface AnnotationCanvasPoint {
  x: number;
  y: number;
}

export function getAnnotationCanvasPoint(
  event: PointerEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement | null,
): AnnotationCanvasPoint | null {
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

export function readRegionsFromMarkCanvas(markCanvas: HTMLCanvasElement): AnnotationBounds[] {
  const markCtx = markCanvas.getContext('2d');
  if (!markCtx) return [];
  const { data, width, height } = markCtx.getImageData(0, 0, markCanvas.width, markCanvas.height);
  const visited = new Uint8Array(width * height);
  const regions: Array<AnnotationBounds & { pixelCount: number }> = [];
  const stack: number[] = [];
  const isMarked = (index: number) => data[index * 4 + 3] > 0;

  for (let start = 0; start < width * height; start += 1) {
    if (visited[start] || !isMarked(start)) continue;
    visited[start] = 1;
    stack.length = 0;
    stack.push(start);
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let pixelCount = 0;

    while (stack.length > 0) {
      const index = stack.pop();
      if (typeof index !== 'number') break;
      const x = index % width;
      const y = Math.floor(index / width);
      pixelCount += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nextX = x + dx;
          const nextY = y + dy;
          if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue;
          const nextIndex = nextY * width + nextX;
          if (visited[nextIndex] || !isMarked(nextIndex)) continue;
          visited[nextIndex] = 1;
          stack.push(nextIndex);
        }
      }
    }

    if (pixelCount >= 8) regions.push({ minX, minY, maxX, maxY, pixelCount });
  }

  return regions
    .sort((a, b) => a.minY - b.minY || a.minX - b.minX)
    .map(({ pixelCount: _pixelCount, ...bounds }) => bounds);
}

export function readBoundsFromMarkCanvas(markCanvas: HTMLCanvasElement): AnnotationBounds | null {
  return mergeAnnotationBounds(readRegionsFromMarkCanvas(markCanvas));
}

export function calculateAnnotationCanvasSize(image: HTMLImageElement) {
  const maxWidth = 1200;
  const maxHeight = 760;
  const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight, 1);
  return {
    width: Math.max(1, Math.round(image.naturalWidth * scale)),
    height: Math.max(1, Math.round(image.naturalHeight * scale)),
  };
}

export function drawVisibleAnnotationCanvas({
  canvas,
  markCanvas,
  image,
}: {
  canvas: HTMLCanvasElement | null;
  markCanvas: HTMLCanvasElement | null;
  image: HTMLImageElement | null;
}) {
  const ctx = canvas?.getContext('2d');
  if (!canvas || !markCanvas || !image || !ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  ctx.drawImage(markCanvas, 0, 0);
}

export function expandAnnotationBounds(
  bounds: AnnotationBounds | null,
  point: AnnotationCanvasPoint,
  brushSize: number,
): AnnotationBounds {
  const radius = brushSize / 2;
  const next = {
    minX: Math.max(0, point.x - radius),
    minY: Math.max(0, point.y - radius),
    maxX: point.x + radius,
    maxY: point.y + radius,
  };
  return bounds
    ? {
      minX: Math.min(bounds.minX, next.minX),
      minY: Math.min(bounds.minY, next.minY),
      maxX: Math.max(bounds.maxX, next.maxX),
      maxY: Math.max(bounds.maxY, next.maxY),
    }
    : next;
}

export function strokeAnnotationSegment({
  ctx,
  from,
  to,
  brushColor,
  brushSize,
}: {
  ctx: CanvasRenderingContext2D;
  from: AnnotationCanvasPoint;
  to: AnnotationCanvasPoint;
  brushColor: string;
  brushSize: number;
}) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = brushSize;
  ctx.strokeStyle = brushColor;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}
