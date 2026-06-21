import { useEffect, useRef, useState } from 'react';
import { ImageIcon, Link2, Plus, Trash2, Wrench } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ModelConfigItem } from '@autix/shared-store';
import { type VideoClip, type VideoClipMaterial } from '@autix/shared-store';
import { Button } from '../../../ui/button';
import { cn } from '../../../ui/utils';
import { MaterialPicker } from '../../MaterialPicker';
import { ImeSafeTextarea } from '../shared/ImeSafeControls';
import { StoryboardClipDetailPanel } from './StoryboardClipDetailPanel';
import { VideoMaterialSlotsPanel } from './VideoMaterialSlotsPanel';
import { VideoWorkspacePromptActionBar } from './VideoWorkspacePromptActionBar';
import {
  STORYBOARD_TIMELINE_MAX_CLIP_DURATION,
  STORYBOARD_TIMELINE_MIN_CLIP_DURATION,
  STORYBOARD_TIMELINE_TOTAL_MAX_DURATION,
  clampStoryboardClipDuration,
  clipParams,
  suggestStoryboardClipDuration,
  type VideoMaterialTarget,
  type VideoWorkspaceMode,
} from '../constants';

const TIMELINE_SECOND_WIDTH = 64;
const TIMELINE_TOTAL_WIDTH = STORYBOARD_TIMELINE_TOTAL_MAX_DURATION * TIMELINE_SECOND_WIDTH;
const TIMELINE_DEFAULT_CLIP_DURATION = 5;

function getClipDuration(clip: VideoClip, fallbackDuration = 3) {
  return clampStoryboardClipDuration(clipParams(clip).duration ?? fallbackDuration);
}

function resolveTimelineFrame(
  clip: VideoClip,
  clips: VideoClip[],
): { material: VideoClipMaterial | null; chained: boolean } {
  if (clip.chainFromPrev) {
    const previousClip = clips.find((item) => item.order === clip.order - 1);
    const previousLastFrame = previousClip?.materials.find((material) => material.role === 'last_frame') ?? null;
    if (previousLastFrame) return { material: previousLastFrame, chained: true };
  }

  return {
    material:
      clip.materials.find((material) => material.role === 'first_frame') ??
      clip.materials.find((material) => material.role === 'reference_image') ??
      clip.materials.find((material) => material.role === 'last_frame') ??
      null,
    chained: false,
  };
}

export function VideoWorkspaceConfigPanel({
  mode,
  clips,
  selectedClip,
  selectedClipId,
  storyboardPrompt,
  projectId,
  onSelectClip,
  onOpenTools,
  onAddClip,
  onStoryboardPromptChange,
  onStoryboardPromptBlur,
  onPromptChange,
  onTitleChange,
  onClipDurationChange,
  onDeleteClip,
  onOptimizePrompt,
  optimizingPrompt,
  onSwapFirstLastFrame,
  textModelId,
  textModels,
  textModelsLoading,
  modelConfigId,
  videoModels,
  videoModelsLoading,
  estimatedCost,
  estimatingCost,
  canGenerate,
  onTextModelChange,
  onVideoModelChange,
  onGenerate,
}: {
  mode: VideoWorkspaceMode;
  clips: VideoClip[];
  selectedClip: VideoClip | null;
  selectedClipId: string | null;
  storyboardPrompt: string;
  projectId: string;
  onSelectClip: (clipId: string | null) => void;
  onOpenTools: () => void;
  onAddClip: (duration: number) => void;
  onStoryboardPromptChange: (prompt: string) => void;
  onStoryboardPromptBlur: () => void;
  onPromptChange: (clip: VideoClip, prompt: string) => void;
  onTitleChange: (clip: VideoClip, title: string) => void;
  onClipDurationChange: (clip: VideoClip, duration: number) => void;
  onDeleteClip: (clip: VideoClip) => void;
  onOptimizePrompt: () => void;
  optimizingPrompt: boolean;
  onSwapFirstLastFrame: () => void;
  textModelId: string | null;
  textModels: ModelConfigItem[];
  textModelsLoading: boolean;
  modelConfigId: string;
  videoModels: ModelConfigItem[];
  videoModelsLoading: boolean;
  estimatedCost: number | null;
  estimatingCost: boolean;
  canGenerate?: boolean;
  onTextModelChange: (modelId: string | null) => void;
  onVideoModelChange: (modelId: string) => void;
  onGenerate: (clip: VideoClip) => void;
}) {
  const t = useTranslations('videoWorkbench.configPanel');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerRole, setPickerRole] = useState<VideoMaterialTarget>('first_frame');
  const [pickerClipId, setPickerClipId] = useState<string | null>(null);
  const [resizingClip, setResizingClip] = useState<{ clipId: string; duration: number } | null>(null);
  const [storyboardDetailOpen, setStoryboardDetailOpen] = useState(false);
  const timelineRailRef = useRef<HTMLDivElement | null>(null);
  const pickerClip = clips.find((clip) => clip.id === pickerClipId) ?? selectedClip;
  const optimizeSource = mode === 'storyboard' ? storyboardPrompt : selectedClip?.prompt;
  const canOptimize = Boolean(optimizeSource?.trim()) && !optimizingPrompt;
  const promptLabel =
    mode === 'first_last_frame'
      ? t('promptLabel.firstLastFrame')
      : mode === 'standard'
        ? t('promptLabel.standard')
        : t('promptLabel.storyboard');
  const materialSlots: Array<{ role: VideoMaterialTarget; label: string }> =
    mode === 'first_last_frame'
      ? [
        { role: 'first_frame', label: t('slots.firstFrameImage') },
        { role: 'last_frame', label: t('slots.lastFrameImage') },
        { role: 'reference_audio', label: t('slots.referenceAudio') },
      ]
      : mode === 'standard'
        ? [
          { role: 'reference_image', label: t('slots.referenceImage') },
          { role: 'reference_video', label: t('slots.referenceVideo') },
          { role: 'reference_audio', label: t('slots.referenceAudio') },
        ]
        : [];
  const storyboardDetailImageSlots: Array<{ role: VideoMaterialTarget; label: string }> = [
    { role: 'first_frame', label: t('slots.firstFrameImage') },
    { role: 'reference_image', label: t('slots.referenceImage') },
    { role: 'last_frame', label: t('slots.lastFrameImage') },
  ];

  const openPicker = (role: VideoMaterialTarget, clipId = selectedClip?.id ?? null) => {
    if (!clipId) return;
    setPickerRole(role);
    setPickerClipId(clipId);
    setPickerOpen(true);
  };
  const fallbackClipDuration = suggestStoryboardClipDuration(clips.length);
  const storyboardTotalDuration = clips.reduce((total, clip) => total + getClipDuration(clip, fallbackClipDuration), 0);
  const resizingSourceClip = resizingClip
    ? clips.find((clip) => clip.id === resizingClip.clipId) ?? null
    : null;
  const storyboardDisplayTotalDuration = resizingSourceClip && resizingClip
    ? storyboardTotalDuration - getClipDuration(resizingSourceClip, fallbackClipDuration) + resizingClip.duration
    : storyboardTotalDuration;
  let timelineCursor = 0;
  const storyboardTimelineItems = clips.map((clip) => {
    const duration = resizingClip?.clipId === clip.id
      ? resizingClip.duration
      : getClipDuration(clip, fallbackClipDuration);
    const start = timelineCursor;
    const end = start + duration;
    timelineCursor = end;
    return {
      clip,
      duration,
      start,
      end,
      frame: resolveTimelineFrame(clip, clips),
    };
  });
  const timelineOverMax = storyboardDisplayTotalDuration > STORYBOARD_TIMELINE_TOTAL_MAX_DURATION;
  const remainingDuration = Math.max(0, STORYBOARD_TIMELINE_TOTAL_MAX_DURATION - storyboardDisplayTotalDuration);
  const nextClipDuration = Math.min(TIMELINE_DEFAULT_CLIP_DURATION, remainingDuration);
  const canAddClip = nextClipDuration >= STORYBOARD_TIMELINE_MIN_CLIP_DURATION;
  const selectedStoryboardMaterialCount = selectedClip
    ? selectedClip.materials.filter((material) =>
      storyboardDetailImageSlots.some((slot) => slot.role === material.role),
    ).length
    : 0;
  const selectedStoryboardPromptSummary = selectedClip?.prompt?.trim() || t('storyboard.detail.promptPlaceholder');

  useEffect(() => {
    setStoryboardDetailOpen(false);
  }, [selectedClipId]);

  const handleDurationResizeStart = (event: React.PointerEvent<HTMLButtonElement>, clip: VideoClip) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startDuration = getClipDuration(clip, fallbackClipDuration);
    const otherDuration = storyboardTotalDuration - startDuration;
    const timelineWidth = timelineRailRef.current?.getBoundingClientRect().width ?? TIMELINE_TOTAL_WIDTH;
    const secondWidth = Math.max(1, timelineWidth / STORYBOARD_TIMELINE_TOTAL_MAX_DURATION);
    let nextDuration = startDuration;
    setResizingClip({ clipId: clip.id, duration: startDuration });

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaSeconds = Math.round((moveEvent.clientX - startX) / secondWidth);
      const totalMaxDuration = STORYBOARD_TIMELINE_TOTAL_MAX_DURATION - otherDuration;
      const maxDuration = totalMaxDuration >= STORYBOARD_TIMELINE_MIN_CLIP_DURATION
        ? Math.min(STORYBOARD_TIMELINE_MAX_CLIP_DURATION, totalMaxDuration)
        : STORYBOARD_TIMELINE_MIN_CLIP_DURATION;
      nextDuration = clampStoryboardClipDuration(
        startDuration + deltaSeconds,
        STORYBOARD_TIMELINE_MIN_CLIP_DURATION,
        maxDuration,
      );
      setResizingClip({ clipId: clip.id, duration: nextDuration });
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      setResizingClip(null);
      if (nextDuration !== startDuration) onClipDurationChange(clip, nextDuration);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{t('title')}</h2>
        </div>
      </div>

      {mode !== 'storyboard' && (
        <VideoMaterialSlotsPanel
          mode={mode}
          selectedClip={selectedClip}
          materialSlots={materialSlots}
          onOpenPicker={openPicker}
          onSwapFirstLastFrame={onSwapFirstLastFrame}
        />
      )}

      {mode === 'storyboard' && (
        <div className="mb-4 rounded-lg border border-border bg-background p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-medium">{t('storyboard.title')}</h3>
              <p className="text-[11px] text-muted-foreground">{t('storyboard.description')}</p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => onAddClip(nextClipDuration)}
                disabled={!canAddClip}
              >
                <Plus className="size-3" />
                {t('storyboard.addClip')}
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={onOpenTools}>
                <Wrench className="size-3" />
                {t('storyboard.generateClips')}
              </Button>
            </div>
          </div>
          {clips.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-8 text-center text-xs text-muted-foreground">
              {t('storyboard.emptyHint')}
            </div>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{t('storyboard.timeline')}</span>
                <span
                  className={cn(
                    timelineOverMax && 'text-destructive',
                  )}
                >
                  {t('storyboard.timelineUsage', {
                    used: storyboardDisplayTotalDuration,
                    limit: STORYBOARD_TIMELINE_TOTAL_MAX_DURATION,
                  })}
                </span>
              </div>
              <div className="overflow-x-auto pb-1">
                <div
                  ref={timelineRailRef}
                  className="relative min-h-[164px] w-full"
                  style={{
                    minWidth: Math.max(TIMELINE_TOTAL_WIDTH, storyboardDisplayTotalDuration * TIMELINE_SECOND_WIDTH),
                  }}
                >
                  <div
                    className="absolute inset-y-0 inset-x-0 rounded-md border border-border bg-muted/30"
                    style={{
                      backgroundImage: 'linear-gradient(to right, rgba(148, 163, 184, 0.22) 1px, transparent 1px)',
                      backgroundSize: `calc(100% / ${STORYBOARD_TIMELINE_TOTAL_MAX_DURATION}) 100%`,
                    }}
                  />
                  <div className="relative flex min-h-[164px]">
                    {storyboardTimelineItems.map(({ clip, duration, start, end, frame }) => {
                      const active = clip.id === selectedClipId;
                      return (
                        <div
                          key={clip.id}
                          role="button"
                          tabIndex={0}
                          style={{ width: `${(duration / STORYBOARD_TIMELINE_TOTAL_MAX_DURATION) * 100}%` }}
                          className={cn(
                            'group relative shrink-0 overflow-hidden border-r border-border bg-card text-left transition-colors first:rounded-l-md',
                            active ? 'bg-primary/8 ring-1 ring-inset ring-primary' : 'hover:bg-accent',
                          )}
                          onClick={() => onSelectClip(clip.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              onSelectClip(clip.id);
                            }
                          }}
                        >
                          <div className="relative h-24 overflow-hidden bg-muted">
                            {frame.material ? (
                              <img
                                src={frame.material.url}
                                alt={frame.material.name ?? clip.title ?? t('clipDefaultTitle', { order: clip.order })}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-muted/60 text-muted-foreground">
                                <ImageIcon className="size-5" />
                              </div>
                            )}
                            <div className="absolute left-1.5 top-1.5 flex items-center gap-1">
                              <span className="rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-medium shadow-sm">
                                {start}-{end}s
                              </span>
                              <span className="rounded bg-background/90 px-1.5 py-0.5 text-[10px] text-muted-foreground shadow-sm">
                                {duration}s
                              </span>
                              {frame.chained && (
                                <span className="flex size-5 items-center justify-center rounded bg-primary/85 text-primary-foreground shadow-sm">
                                  <Link2 className="size-3" />
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-background/90 text-muted-foreground opacity-75 shadow-sm transition-colors hover:text-destructive hover:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
                            onClick={(event) => {
                              event.stopPropagation();
                              onDeleteClip(clip);
                            }}
                            aria-label={t('clip.deleteAria', { title: clip.title || t('clipDefaultTitle', { order: clip.order }) })}
                          >
                            <Trash2 className="size-3" />
                          </button>
                          <div className="px-2 py-2">
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <span className="truncate text-xs font-medium">{clip.title || t('clipDefaultTitle', { order: clip.order })}</span>
                            </div>
                            <p className="line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                              {clip.prompt || t('clip.descriptionPlaceholder')}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-transparent transition-colors hover:bg-primary/35 focus:bg-primary/35 focus:outline-none"
                            aria-label={t('clip.resizeAria', { title: clip.title || t('clipDefaultTitle', { order: clip.order }) })}
                            title={t('clip.resizeTitle')}
                            onClick={(event) => event.stopPropagation()}
                            onPointerDown={(event) => handleDurationResizeStart(event, clip)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              {selectedClip && (
                <StoryboardClipDetailPanel
                  clip={selectedClip}
                  open={storyboardDetailOpen}
                  promptSummary={selectedStoryboardPromptSummary}
                  materialCount={selectedStoryboardMaterialCount}
                  imageSlots={storyboardDetailImageSlots}
                  onToggle={() => setStoryboardDetailOpen((open) => !open)}
                  onTitleChange={onTitleChange}
                  onPromptChange={onPromptChange}
                  onOpenPicker={openPicker}
                />
              )}
            </>
          )}
        </div>
      )}

      {selectedClip ? (
        <div className="space-y-3">
          {mode !== 'storyboard' && (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">{promptLabel}</span>
              <ImeSafeTextarea
                className="min-h-36 w-full resize-y rounded-md border border-border bg-background px-3 py-3 text-sm leading-6 outline-none placeholder:text-muted-foreground focus:border-primary"
                placeholder={t('promptInput.standardPlaceholder')}
                value={selectedClip.prompt ?? ''}
                onValueChange={(value) => onPromptChange(selectedClip, value)}
              />
            </label>
          )}
          {mode === 'storyboard' && (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">{t('promptInput.storyboardLabel')}</span>
              <ImeSafeTextarea
                className="min-h-28 w-full resize-y rounded-md border border-border bg-background px-3 py-3 text-sm leading-6 outline-none placeholder:text-muted-foreground focus:border-primary"
                placeholder={t('promptInput.storyboardPlaceholder')}
                value={storyboardPrompt}
                onValueChange={onStoryboardPromptChange}
                onCommit={() => onStoryboardPromptBlur()}
              />
            </label>
          )}
          <VideoWorkspacePromptActionBar
            clip={selectedClip}
            canOptimize={canOptimize}
            optimizingPrompt={optimizingPrompt}
            textModelId={textModelId}
            textModels={textModels}
            textModelsLoading={textModelsLoading}
            modelConfigId={modelConfigId}
            videoModels={videoModels}
            videoModelsLoading={videoModelsLoading}
            estimatedCost={estimatedCost}
            estimatingCost={estimatingCost}
            canGenerate={canGenerate}
            onOptimizePrompt={onOptimizePrompt}
            onTextModelChange={onTextModelChange}
            onVideoModelChange={onVideoModelChange}
            onGenerate={onGenerate}
          />
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
          {t('preparingClipEditor')}
        </div>
      )}

      {pickerClip && (
        <MaterialPicker
          open={pickerOpen}
          onOpenChange={(open) => {
            setPickerOpen(open);
            if (!open) setPickerClipId(null);
          }}
          role={pickerRole}
          clipId={pickerClip.id}
          projectId={projectId}
          clips={mode === 'storyboard' ? clips : undefined}
        />
      )}
    </section>
  );
}
