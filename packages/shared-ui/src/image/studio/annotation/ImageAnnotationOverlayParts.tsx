import type { PointerEvent, RefObject } from 'react';
import { Brush, Loader2, X } from 'lucide-react';
import { Button } from '../../../ui/button';
import { cn } from '../../../ui/utils';
import {
  ANNOTATION_COLOR_DEFINITIONS,
  type AnnotationColorValue,
  type AnnotationTarget,
} from '../constants';

interface ImageAnnotationToolbarProps {
  target: AnnotationTarget;
  hint: string;
  brushColor: string;
  brushSize: number;
  canUndo: boolean;
  hasMarks: boolean;
  isSaving: boolean;
  ready: boolean;
  labels: {
    clear: string;
    close: string;
    colorPickerTitle: (color: string) => string;
    colors: (key: AnnotationColorValue) => string;
    undo: string;
    useAnnotation: string;
  };
  onBrushColorChange: (color: string) => void;
  onBrushSizeChange: (size: number) => void;
  onClear: () => void;
  onClose: () => void;
  onUndo: () => void;
  onUse: () => void;
}

export function ImageAnnotationToolbar({
  target,
  hint,
  brushColor,
  brushSize,
  canUndo,
  hasMarks,
  isSaving,
  ready,
  labels,
  onBrushColorChange,
  onBrushSizeChange,
  onClear,
  onClose,
  onUndo,
  onUse,
}: ImageAnnotationToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold">{target.label}</h2>
        <p className="truncate text-xs text-muted-foreground">
          {target.prompt || hint}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-9 items-center gap-1 rounded-md border border-border bg-background px-2">
          {ANNOTATION_COLOR_DEFINITIONS.map((color) => {
            const colorLabel = labels.colors(color.key);
            const colorTitle = labels.colorPickerTitle(colorLabel);
            return (
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
                title={colorTitle}
                aria-label={colorTitle}
                onClick={() => onBrushColorChange(color.value)}
              />
            );
          })}
        </div>
        <label className="flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-xs text-muted-foreground">
          <Brush className="size-3.5" />
          <input
            type="range"
            min={6}
            max={48}
            value={brushSize}
            onChange={(event) => onBrushSizeChange(Number(event.target.value))}
            className="w-24 accent-primary"
          />
        </label>
        <Button variant="outline" size="sm" onClick={onUndo} disabled={!ready || !canUndo}>
          {labels.undo}
        </Button>
        <Button variant="outline" size="sm" onClick={onClear} disabled={!ready}>
          {labels.clear}
        </Button>
        <Button
          size="sm"
          onPointerDown={(event) => {
            event.preventDefault();
            onUse();
          }}
          onClick={onUse}
          disabled={!ready || !hasMarks || isSaving}
        >
          {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {labels.useAnnotation}
        </Button>
        <button
          type="button"
          className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={onClose}
          aria-label={labels.close}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

interface ImageAnnotationCanvasStageProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  markCanvasRef: RefObject<HTMLCanvasElement | null>;
  loadingLabel: string;
  ready: boolean;
  onPointerCancel: () => void;
  onPointerDown: (event: PointerEvent<HTMLCanvasElement>) => void;
  onPointerLeave: () => void;
  onPointerMove: (event: PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: () => void;
}

export function ImageAnnotationCanvasStage({
  canvasRef,
  markCanvasRef,
  loadingLabel,
  ready,
  onPointerCancel,
  onPointerDown,
  onPointerLeave,
  onPointerMove,
  onPointerUp,
}: ImageAnnotationCanvasStageProps) {
  return (
    <div className="min-h-0 flex flex-1 items-center justify-center overflow-auto bg-black p-3">
      {!ready && (
        <div className="flex items-center gap-2 text-sm text-white/70">
          <Loader2 className="size-4 animate-spin" />
          {loadingLabel}
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={cn(
          'max-h-[78vh] max-w-full touch-none rounded-md bg-black shadow-lg',
          ready ? 'block cursor-crosshair' : 'hidden',
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerLeave}
      />
      <canvas ref={markCanvasRef} className="hidden" />
    </div>
  );
}
