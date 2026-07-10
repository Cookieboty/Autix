'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import {
  AlertTriangle,
  Clapperboard,
  ExternalLink,
  Film,
  GripVertical,
  Loader2,
  Play,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { VideoComposition, VideoCompositionIssue, VideoCompositionMode } from './draw-video-graph';

type Tr = (key: string, values?: Record<string, string | number>) => string;

export interface VideoNodeOverlayImage {
  elementId: string;
  url: string;
  label: string;
}

export interface VideoNodeOverlayView {
  id: string;
  screenX: number;
  screenY: number;
  width: number;
  height: number;
  zoom: number;
  canvasWidth?: number;
  canvasHeight?: number;
  prompt: string;
  projectId?: string;
  generation?: {
    status?: string;
    generationId?: string;
    videoUrl?: string;
    thumbnailUrl?: string;
    error?: string;
  };
  inputImages: VideoNodeOverlayImage[];
  composition: VideoComposition;
  modelConfigId?: string;
}

export function VideoNodeOverlay(props: {
  t: Tr;
  view: VideoNodeOverlayView;
  generating: boolean;
  optimizingPrompt: boolean;
  modelPicker: ReactNode;
  onPromptChange: (value: string) => void;
  onOptimizePrompt: () => void;
  onShotPromptChange: (linkElementId: string, prompt: string) => void;
  onShotOrderChange: (linkElementIds: string[]) => void;
  onDelete: () => void;
  onGenerate: () => void;
  onOpenWorkbench: () => void;
  onMeasure?: (id: string, screenWidth: number, screenHeight: number) => void;
}) {
  const { t, view } = props;
  const rootRef = useRef<HTMLDivElement>(null);
  const onMeasure = props.onMeasure;
  // Report the panel's real rendered footprint so the host can size the
  // (otherwise fixed, invisible) Excalidraw node element to match — keeping the
  // selection box, connection anchors and auto-layout in sync with what's drawn.
  useEffect(() => {
    const element = rootRef.current;
    if (!element || !onMeasure) return;
    const report = () => onMeasure(view.id, element.offsetWidth, element.offsetHeight);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => observer.disconnect();
    // view.zoom is a dep so we re-report on zoom changes — the capped panel px
    // may not change, so ResizeObserver alone wouldn't re-sync the element size.
  }, [view.id, view.zoom, onMeasure]);
  const composition = view.composition;
  const blockingCount = composition.issues.filter((issue) => issue.level === 'blocking').length;
  const warningCount = composition.issues.filter((issue) => issue.level === 'warning').length;
  const mode = composition.mode;
  const isGenerating = props.generating || view.generation?.status === 'generating';
  const canGenerate = !isGenerating && blockingCount === 0;
  const thumbnail = view.generation?.thumbnailUrl;
  const videoUrl = view.generation?.videoUrl;
  // Anchor the panel to the node's screen position so it moves 1:1 with the
  // node when the canvas is panned. No viewport clamping — clamping made the
  // panel stick to the viewport edge and detach from its node while dragging.
  const panelWidth = Math.max(240, Math.min(420, view.width));
  const left = view.screenX;
  const top = view.screenY;

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute z-30 overflow-hidden rounded-lg border border-emerald-300/35 bg-neutral-950/95 text-white shadow-[0_24px_80px_rgba(0,0,0,0.48)] backdrop-blur-xl"
      style={{
        left,
        top,
        width: panelWidth,
      }}
    >
      {(thumbnail || videoUrl) && (
        <div className="relative aspect-video w-full overflow-hidden border-b border-white/10 bg-black">
          {thumbnail ? (
            <img src={thumbnail} alt="" className="size-full object-cover" />
          ) : videoUrl ? (
            <video src={videoUrl} controls className="pointer-events-auto size-full object-cover" />
          ) : null}
          {videoUrl && (
            <a
              href={videoUrl}
              target="_blank"
              rel="noreferrer"
              title={t('video.openVideo')}
              className="pointer-events-auto absolute right-2 top-2 grid size-8 place-items-center rounded-md bg-black/70 text-white transition hover:bg-black"
            >
              <ExternalLink className="size-4" />
            </a>
          )}
        </div>
      )}

      <div className="space-y-2 p-2.5">
        <div className="flex items-center gap-2">
          <div className="grid size-7 shrink-0 place-items-center rounded-md bg-emerald-300 text-black">
            <Film className="size-4" />
          </div>
          <div
            title={t('video.autoMode')}
            className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/[0.06] px-2 py-1.5 text-xs font-semibold text-white"
          >
            <span className="block truncate">{t('video.recognizedAs', { mode: modeLabel(composition.autoMode, t) })}</span>
          </div>
          {(blockingCount > 0 || warningCount > 0) && (
            <span
              title={composition.issues.map((issue) => videoIssueMessage(issue, t)).join('\n')}
              className={`pointer-events-auto inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-semibold ${
                blockingCount > 0 ? 'bg-red-500/18 text-red-100' : 'bg-amber-400/16 text-amber-100'
              }`}
            >
              <AlertTriangle className="size-3.5" />
              {blockingCount || warningCount}
            </span>
          )}
          <button
            type="button"
            title={t('video.deleteVideoNode')}
            onClick={props.onDelete}
            className="pointer-events-auto grid size-7 shrink-0 place-items-center rounded-md border border-white/10 text-white/50 transition hover:border-red-300/35 hover:bg-red-500/15 hover:text-red-100"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>

        {view.inputImages.length > 0 && (
          <div className="pointer-events-auto flex gap-1.5 overflow-x-auto pb-0.5">
            {view.inputImages.map((image) => (
              <div key={image.elementId} className="size-12 shrink-0 overflow-hidden rounded-md border border-white/15 bg-white/[0.04]">
                <img src={image.url} alt={image.label} className="size-full object-cover" />
              </div>
            ))}
          </div>
        )}

        {mode === 'storyboard' && (
          <div className="flex gap-1.5 overflow-x-auto rounded-md border border-white/10 bg-white/[0.04] p-1.5">
            {composition.shots.length === 0 ? (
              <div className="flex h-9 items-center gap-1.5 px-2 text-xs text-white/45">
                <Clapperboard className="size-3.5" />
                {t('video.noShots')}
              </div>
            ) : (
              composition.shots.map((shot, index) => (
                <div
                  key={shot.linkElementId}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const sourceId = event.dataTransfer.getData('application/x-video-shot-id');
                    if (!sourceId || sourceId === shot.linkElementId) return;
                    props.onShotOrderChange(reorderByDrop(
                      composition.shots.map((item) => item.linkElementId),
                      sourceId,
                      shot.linkElementId,
                    ));
                  }}
                  className="pointer-events-auto flex h-9 min-w-36 max-w-48 items-center gap-1.5 rounded bg-black/35 px-1.5 text-xs"
                >
                  <button
                    type="button"
                    draggable
                    title={t('video.dragToSort')}
                    onDragStart={(event) => {
                      event.dataTransfer.setData('application/x-video-shot-id', shot.linkElementId);
                      event.dataTransfer.effectAllowed = 'move';
                    }}
                    className="grid size-5 shrink-0 cursor-grab place-items-center rounded text-white/38 active:cursor-grabbing"
                  >
                    <GripVertical className="size-3.5" />
                  </button>
                  <span className="font-semibold text-emerald-200">{index + 1}</span>
                  <input
                    value={shot.prompt}
                    onChange={(event) => props.onShotPromptChange(shot.linkElementId, event.target.value)}
                    placeholder={t('video.shotDescription')}
                    className="min-w-0 flex-1 bg-transparent text-white/78 outline-none placeholder:text-white/35"
                  />
                </div>
              ))
            )}
          </div>
        )}

        <div className="relative">
          <textarea
            value={view.prompt}
            onChange={(event) => props.onPromptChange(event.target.value)}
            placeholder={mode === 'storyboard' ? t('video.storyboardPromptPlaceholder') : t('video.videoPromptPlaceholder')}
            rows={3}
            className="pointer-events-auto max-h-32 min-h-20 w-full resize-none rounded-md border border-white/10 bg-white/[0.05] px-2.5 py-2 pr-10 text-sm text-white outline-none placeholder:text-white/35 focus:border-emerald-200/55"
          />
          <button
            type="button"
            title={t('video.optimizeVideoPrompt')}
            disabled={props.optimizingPrompt || !view.prompt.trim()}
            onClick={props.onOptimizePrompt}
            className="pointer-events-auto absolute right-2 top-2 grid size-7 place-items-center rounded-md border border-white/10 bg-black/50 text-white/60 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
          >
            {props.optimizingPrompt ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          </button>
        </div>

        {(isGenerating || view.generation?.error) && (
          <div className={`rounded-md px-2.5 py-2 text-xs ${
            view.generation?.error ? 'bg-red-500/14 text-red-100' : 'bg-emerald-300/12 text-emerald-100'
          }`}
          >
            {view.generation?.error || t('video.generating')}
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <div className="pointer-events-auto min-w-0 flex-1">
            {props.modelPicker}
          </div>
          <button
            type="button"
            title={t('video.openWorkbench')}
            onClick={props.onOpenWorkbench}
            className="pointer-events-auto inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-white/10 px-2.5 text-xs font-semibold text-white/72 transition hover:bg-white/10 hover:text-white"
          >
            <ExternalLink className="size-3.5" />
            {t('video.workbench')}
          </button>
          <button
            type="button"
            title={t('actions.generate')}
            disabled={!canGenerate}
            onClick={props.onGenerate}
            className="pointer-events-auto inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-white px-3 text-xs font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isGenerating ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
            {t('video.generate')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function videoIssueMessage(issue: VideoCompositionIssue, t: Tr): string {
  return t(`video.issues.${issue.code}`) || issue.message;
}

function modeLabel(mode: VideoCompositionMode, t: Tr): string {
  if (mode === 'text_to_video') return t('video.modes.textToVideo');
  if (mode === 'image_to_video') return t('video.modes.imageToVideo');
  if (mode === 'first_last_frame') return t('video.modes.firstLastFrame');
  if (mode === 'storyboard') return t('video.modes.storyboard');
  return t('video.modes.reference');
}

// Drop `sourceId` onto `targetId` so the source takes the target's slot. The
// insert side depends on drag direction: dragging forward (source was before
// target) lands the source *after* the target; dragging backward lands it
// *before*. A fixed "insert before" is off by one for every forward drag.
function reorderByDrop(ids: string[], sourceId: string, targetId: string): string[] {
  const from = ids.indexOf(sourceId);
  const to = ids.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return ids;
  const next = ids.slice();
  next.splice(from, 1);
  const targetIndex = next.indexOf(targetId);
  const insertAt = from < to ? targetIndex + 1 : targetIndex;
  next.splice(insertAt, 0, sourceId);
  return next;
}
