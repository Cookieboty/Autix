import { useEffect, useRef, useState } from 'react';
import { Brush, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../ui/button';
import { cn } from '../../../ui/utils';
import {
  ANNOTATION_COLORS,
  buildAnnotationPromptNote,
  cloneAnnotationBounds,
  mergeAnnotationBounds,
  type AnnotationBounds,
  type AnnotationTarget,
  type ImageAnnotationResult,
  type MarkHistoryEntry,
} from '../constants';

export function ImageAnnotationOverlay({
  target,
  onClose,
  onUse,
}: {
  target: AnnotationTarget;
  onClose: () => void;
  onUse: (result: ImageAnnotationResult) => Promise<void> | void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const markCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const markHistoryRef = useRef<MarkHistoryEntry[]>([]);
  const boundsRef = useRef<AnnotationBounds | null>(null);
  const savingRef = useRef(false);
  const [brushSize, setBrushSize] = useState(18);
  const [brushColor, setBrushColor] = useState(ANNOTATION_COLORS[0].value);
  const [ready, setReady] = useState(false);
  const [hasMarks, setHasMarks] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const setMarkHistory = (entries: MarkHistoryEntry[]) => {
    markHistoryRef.current = entries;
    setCanUndo(entries.length > 1);
  };

  const renderVisibleCanvas = () => {
    const canvas = canvasRef.current;
    const markCanvas = markCanvasRef.current;
    const image = imageRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !markCanvas || !image || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    ctx.drawImage(markCanvas, 0, 0);
  };

  const readRegionsFromMarkCanvas = (markCanvas: HTMLCanvasElement): AnnotationBounds[] => {
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
  };

  const readBoundsFromMarkCanvas = (markCanvas: HTMLCanvasElement): AnnotationBounds | null => {
    return mergeAnnotationBounds(readRegionsFromMarkCanvas(markCanvas));
  };

  const drawBaseImage = (image: HTMLImageElement) => {
    const canvas = canvasRef.current;
    const markCanvas = markCanvasRef.current;
    if (!canvas || !markCanvas) return;
    const maxWidth = 1200;
    const maxHeight = 760;
    const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight, 1);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.width = width;
    canvas.height = height;
    markCanvas.width = width;
    markCanvas.height = height;
    const ctx = canvas.getContext('2d');
    const markCtx = markCanvas.getContext('2d');
    if (!ctx || !markCtx) return;
    markCtx.clearRect(0, 0, width, height);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    boundsRef.current = null;
    const emptyEntry = { imageData: markCtx.getImageData(0, 0, width, height), bounds: null };
    setMarkHistory([emptyEntry]);
    setHasMarks(false);

    if (!target.overlayUrl) {
      setReady(true);
      return;
    }

    const overlay = new Image();
    overlay.onload = () => {
      markCtx.clearRect(0, 0, width, height);
      markCtx.drawImage(overlay, 0, 0, width, height);
      const bounds = readBoundsFromMarkCanvas(markCanvas);
      boundsRef.current = bounds;
      setHasMarks(Boolean(bounds));
      setMarkHistory(
        bounds
          ? [
            emptyEntry,
            { imageData: markCtx.getImageData(0, 0, width, height), bounds: cloneAnnotationBounds(bounds) },
          ]
          : [emptyEntry],
      );
      renderVisibleCanvas();
      setReady(true);
    };
    overlay.onerror = () => {
      toast.error('历史标注加载失败，可重新标注');
      setReady(true);
    };
    overlay.src = target.overlayUrl;
  };

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setHasMarks(false);
    setCanUndo(false);
    markHistoryRef.current = [];
    boundsRef.current = null;

    const loadImage = (withCors: boolean) => {
      const image = new Image();
      if (withCors) image.crossOrigin = 'anonymous';
      image.onload = () => {
        if (cancelled) return;
        imageRef.current = image;
        drawBaseImage(image);
      };
      image.onerror = () => {
        if (cancelled) return;
        if (withCors) {
          loadImage(false);
          return;
        }
        toast.error('图片加载失败，无法标注');
      };
      image.src = target.url;
    };

    loadImage(/^https?:\/\//.test(target.url));

    return () => {
      cancelled = true;
      imageRef.current = null;
    };
  }, [target.url, target.overlayUrl]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const snapshotMarks = () => {
    const markCanvas = markCanvasRef.current;
    const markCtx = markCanvas?.getContext('2d');
    if (!markCanvas || !markCtx) return;
    markHistoryRef.current = [
      ...markHistoryRef.current.slice(-9),
      {
        imageData: markCtx.getImageData(0, 0, markCanvas.width, markCanvas.height),
        bounds: cloneAnnotationBounds(boundsRef.current),
      },
    ];
    setCanUndo(markHistoryRef.current.length > 1);
  };

  const expandBounds = (point: { x: number; y: number }) => {
    const radius = brushSize / 2;
    const next = {
      minX: Math.max(0, point.x - radius),
      minY: Math.max(0, point.y - radius),
      maxX: point.x + radius,
      maxY: point.y + radius,
    };
    const current = boundsRef.current;
    boundsRef.current = current
      ? {
        minX: Math.min(current.minX, next.minX),
        minY: Math.min(current.minY, next.minY),
        maxX: Math.max(current.maxX, next.maxX),
        maxY: Math.max(current.maxY, next.maxY),
      }
      : next;
  };

  const drawTo = (point: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    const markCanvas = markCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    const markCtx = markCanvas?.getContext('2d');
    const last = lastPointRef.current;
    if (!canvas || !markCanvas || !ctx || !markCtx || !last) return;
    for (const targetCtx of [ctx, markCtx]) {
      targetCtx.lineCap = 'round';
      targetCtx.lineJoin = 'round';
      targetCtx.lineWidth = brushSize;
      targetCtx.strokeStyle = brushColor;
      targetCtx.beginPath();
      targetCtx.moveTo(last.x, last.y);
      targetCtx.lineTo(point.x, point.y);
      targetCtx.stroke();
    }
    expandBounds(last);
    expandBounds(point);
    lastPointRef.current = point;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = getPoint(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    lastPointRef.current = point;
    drawTo({ x: point.x + 0.01, y: point.y + 0.01 });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const point = getPoint(event);
    if (point) drawTo(point);
  };

  const finishDrawing = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    snapshotMarks();
    setHasMarks(Boolean(boundsRef.current));
  };

  const handleUndo = () => {
    const markCanvas = markCanvasRef.current;
    const markCtx = markCanvas?.getContext('2d');
    if (!markCanvas || !markCtx || markHistoryRef.current.length <= 1) return;
    markHistoryRef.current = markHistoryRef.current.slice(0, -1);
    setCanUndo(markHistoryRef.current.length > 1);
    const previous = markHistoryRef.current[markHistoryRef.current.length - 1];
    if (previous) markCtx.putImageData(previous.imageData, 0, 0);
    boundsRef.current = cloneAnnotationBounds(previous?.bounds ?? null);
    setHasMarks(Boolean(boundsRef.current));
    renderVisibleCanvas();
  };

  const handleClear = () => {
    const markCanvas = markCanvasRef.current;
    const markCtx = markCanvas?.getContext('2d');
    if (!markCanvas || !markCtx) return;
    markCtx.clearRect(0, 0, markCanvas.width, markCanvas.height);
    boundsRef.current = null;
    setMarkHistory([{
      imageData: markCtx.getImageData(0, 0, markCanvas.width, markCanvas.height),
      bounds: null,
    }]);
    setHasMarks(false);
    renderVisibleCanvas();
  };

  const handleUse = async () => {
    const markCanvas = markCanvasRef.current;
    if (!markCanvas || savingRef.current || isSaving) return;
    const regions = readRegionsFromMarkCanvas(markCanvas);
    const bounds = mergeAnnotationBounds(regions);
    if (!bounds || regions.length === 0) {
      toast.error('请先圈出需要修改的位置');
      return;
    }
    boundsRef.current = bounds;
    try {
      const overlayUrl = markCanvas.toDataURL('image/png');
      savingRef.current = true;
      setIsSaving(true);
      await onUse({
        targetUrl: target.url,
        overlayUrl,
        note: buildAnnotationPromptNote(target.label, regions, markCanvas.width, markCanvas.height),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '标注合成失败');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[2147483646] flex items-center justify-center bg-black/78 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-lg border border-white/12 bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{target.label}</h2>
            <p className="truncate text-xs text-muted-foreground">
              {target.prompt || '圈出需要修改、保留或强调的位置'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-9 items-center gap-1 rounded-md border border-border bg-background px-2">
              {ANNOTATION_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  className={cn(
                    'size-5 rounded-full border border-black/15 shadow-sm transition',
                    brushColor === color.value
                      ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                      : 'hover:scale-110',
                  )}
                  style={{ backgroundColor: color.swatch }}
                  title={`标注颜色：${color.label}`}
                  aria-label={`标注颜色：${color.label}`}
                  onClick={() => setBrushColor(color.value)}
                />
              ))}
            </div>
            <label className="flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-xs text-muted-foreground">
              <Brush className="size-3.5" />
              <input
                type="range"
                min={6}
                max={48}
                value={brushSize}
                onChange={(event) => setBrushSize(Number(event.target.value))}
                className="w-24 accent-primary"
              />
            </label>
            <Button variant="outline" size="sm" onClick={handleUndo} disabled={!ready || !canUndo}>
              撤销
            </Button>
            <Button variant="outline" size="sm" onClick={handleClear} disabled={!ready}>
              清空
            </Button>
            <Button
              size="sm"
              onPointerDown={(event) => {
                event.preventDefault();
                void handleUse();
              }}
              onClick={() => void handleUse()}
              disabled={!ready || !hasMarks || isSaving}
            >
              {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              使用标注
            </Button>
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={onClose}
              aria-label="关闭"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex flex-1 items-center justify-center overflow-auto bg-black p-3">
          {!ready && (
            <div className="flex items-center gap-2 text-sm text-white/70">
              <Loader2 className="size-4 animate-spin" />
              正在加载图片
            </div>
          )}
          <canvas
            ref={canvasRef}
            className={cn(
              'max-h-[78vh] max-w-full touch-none rounded-md bg-black shadow-lg',
              ready ? 'block cursor-crosshair' : 'hidden',
            )}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishDrawing}
            onPointerCancel={finishDrawing}
            onPointerLeave={finishDrawing}
          />
          <canvas ref={markCanvasRef} className="hidden" />
        </div>
      </div>
    </div>
  );
}
