import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  ANNOTATION_COLOR_DEFINITIONS,
  buildAnnotationPromptNote,
  cloneAnnotationBounds,
  mergeAnnotationBounds,
  type AnnotationBounds,
  type AnnotationTarget,
  type ImageAnnotationResult,
  type MarkHistoryEntry,
} from '../constants';
import {
  ImageAnnotationCanvasStage,
  ImageAnnotationToolbar,
} from './ImageAnnotationOverlayParts';
import {
  calculateAnnotationCanvasSize,
  drawVisibleAnnotationCanvas,
  expandAnnotationBounds,
  getAnnotationCanvasPoint,
  readBoundsFromMarkCanvas,
  readRegionsFromMarkCanvas,
  strokeAnnotationSegment,
  type AnnotationCanvasPoint,
} from './canvas-helpers';
import { useAnnotationPromptMessages } from './useAnnotationPromptMessages';

export { useAnnotationPromptMessages };

export function ImageAnnotationOverlay({
  target,
  onClose,
  onUse,
}: {
  target: AnnotationTarget;
  onClose: () => void;
  onUse: (result: ImageAnnotationResult) => Promise<void> | void;
}) {
  const t = useTranslations('imageStudio.annotation');
  const tColors = useTranslations('imageStudio.annotation.colors');
  const promptMessages = useAnnotationPromptMessages();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const markCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const markHistoryRef = useRef<MarkHistoryEntry[]>([]);
  const boundsRef = useRef<AnnotationBounds | null>(null);
  const savingRef = useRef(false);
  const [brushSize, setBrushSize] = useState(18);
  const [brushColor, setBrushColor] = useState(ANNOTATION_COLOR_DEFINITIONS[0].value);
  const [ready, setReady] = useState(false);
  const [hasMarks, setHasMarks] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const setMarkHistory = (entries: MarkHistoryEntry[]) => {
    markHistoryRef.current = entries;
    setCanUndo(entries.length > 1);
  };

  const renderVisibleCanvas = () => {
    drawVisibleAnnotationCanvas({
      canvas: canvasRef.current,
      markCanvas: markCanvasRef.current,
      image: imageRef.current,
    });
  };

  const drawBaseImage = (image: HTMLImageElement) => {
    const canvas = canvasRef.current;
    const markCanvas = markCanvasRef.current;
    if (!canvas || !markCanvas) return;
    const { width, height } = calculateAnnotationCanvasSize(image);
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
      toast.error(t('overlayLoadFailed'));
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
        toast.error(t('imageLoadFailed'));
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

  const getPoint = (event: PointerEvent<HTMLCanvasElement>) =>
    getAnnotationCanvasPoint(event, canvasRef.current);

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

  const expandBounds = (point: AnnotationCanvasPoint) => {
    boundsRef.current = expandAnnotationBounds(boundsRef.current, point, brushSize);
  };

  const drawTo = (point: AnnotationCanvasPoint) => {
    const canvas = canvasRef.current;
    const markCanvas = markCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    const markCtx = markCanvas?.getContext('2d');
    const last = lastPointRef.current;
    if (!canvas || !markCanvas || !ctx || !markCtx || !last) return;
    for (const targetCtx of [ctx, markCtx]) {
      strokeAnnotationSegment({
        ctx: targetCtx,
        from: last,
        to: point,
        brushColor,
        brushSize,
      });
    }
    expandBounds(last);
    expandBounds(point);
    lastPointRef.current = point;
  };

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = getPoint(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    lastPointRef.current = point;
    drawTo({ x: point.x + 0.01, y: point.y + 0.01 });
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
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
      toast.error(t('needMarkArea'));
      return;
    }
    boundsRef.current = bounds;
    try {
      const overlayUrl = markCanvas.toDataURL('image/png');
      savingRef.current = true;
      setIsSaving(true);
      await onUse({
        targetUrl: target.url,
        targetKey: target.annotationKey,
        overlayUrl,
        note: buildAnnotationPromptNote(
          target.label,
          regions,
          markCanvas.width,
          markCanvas.height,
          promptMessages,
        ),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('mergeFailed'));
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
        <ImageAnnotationToolbar
          target={target}
          hint={t('hint')}
          brushColor={brushColor}
          brushSize={brushSize}
          canUndo={canUndo}
          hasMarks={hasMarks}
          isSaving={isSaving}
          ready={ready}
          labels={{
            clear: t('clear'),
            close: t('close'),
            colorPickerTitle: (color) => t('colorPickerTitle', { color }),
            colors: (key) => tColors(key),
            undo: t('undo'),
            useAnnotation: t('useAnnotation'),
          }}
          onBrushColorChange={setBrushColor}
          onBrushSizeChange={setBrushSize}
          onClear={handleClear}
          onClose={onClose}
          onUndo={handleUndo}
          onUse={() => void handleUse()}
        />
        <ImageAnnotationCanvasStage
          canvasRef={canvasRef}
          markCanvasRef={markCanvasRef}
          loadingLabel={t('loadingImage')}
          ready={ready}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrawing}
          onPointerCancel={finishDrawing}
          onPointerLeave={finishDrawing}
        />
      </div>
    </div>
  );
}
