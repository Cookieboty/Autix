import { useEffect, useRef, useState, type TextareaHTMLAttributes, type InputHTMLAttributes } from 'react';
import { ArrowLeftRight, ChevronDown, ImageIcon, Link2, Loader2, Play, Plus, Sparkles, Trash2, Wrench } from 'lucide-react';
import type { ModelConfigItem } from '@autix/shared-lib';
import { type VideoClip, type VideoClipMaterial } from '@autix/shared-store';
import { Button } from '../../../ui/button';
import { ModelPickerPopover } from '../../../chat/ModelPickerPopover';
import { cn } from '../../../ui/utils';
import { MaterialPicker } from '../../MaterialPicker';
import { MaterialSlot } from '../../MaterialSlot';
import {
  STORYBOARD_TIMELINE_MAX_CLIP_DURATION,
  STORYBOARD_TIMELINE_MIN_CLIP_DURATION,
  STORYBOARD_TIMELINE_TOTAL_MAX_DURATION,
  canGenerateClip,
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

type ImeTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
  onCommit?: (value: string) => void;
};

function ImeSafeTextarea({ value, onValueChange, onCommit, onBlur, ...rest }: ImeTextareaProps) {
  const [draft, setDraft] = useState(value);
  const composingRef = useRef(false);
  useEffect(() => {
    if (!composingRef.current) setDraft(value);
  }, [value]);
  return (
    <textarea
      {...rest}
      value={draft}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        if (!composingRef.current) onValueChange(next);
      }}
      onCompositionStart={() => {
        composingRef.current = true;
      }}
      onCompositionEnd={(event) => {
        composingRef.current = false;
        const next = (event.target as HTMLTextAreaElement).value;
        setDraft(next);
        onValueChange(next);
      }}
      onBlur={(event) => {
        onCommit?.(event.target.value);
        onBlur?.(event);
      }}
    />
  );
}

type ImeInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
};

function ImeSafeInput({ value, onValueChange, ...rest }: ImeInputProps) {
  const [draft, setDraft] = useState(value);
  const composingRef = useRef(false);
  useEffect(() => {
    if (!composingRef.current) setDraft(value);
  }, [value]);
  return (
    <input
      {...rest}
      value={draft}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        if (!composingRef.current) onValueChange(next);
      }}
      onCompositionStart={() => {
        composingRef.current = true;
      }}
      onCompositionEnd={(event) => {
        composingRef.current = false;
        const next = (event.target as HTMLInputElement).value;
        setDraft(next);
        onValueChange(next);
      }}
    />
  );
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
      ? '首尾帧视频提示词'
      : mode === 'standard'
        ? '普通视频提示词'
        : '分镜提示词';
  const materialSlots: Array<{ role: VideoMaterialTarget; label: string }> =
    mode === 'first_last_frame'
      ? [
        { role: 'first_frame', label: '首帧图片' },
        { role: 'last_frame', label: '尾帧图片' },
        { role: 'reference_audio', label: '背景音频' },
      ]
      : mode === 'standard'
        ? [
          { role: 'reference_image', label: '参考图片' },
          { role: 'reference_video', label: '参考视频' },
          { role: 'reference_audio', label: '背景音频' },
        ]
        : [];
  const storyboardDetailImageSlots: Array<{ role: VideoMaterialTarget; label: string }> = [
    { role: 'first_frame', label: '首帧图片' },
    { role: 'reference_image', label: '参考图片' },
    { role: 'last_frame', label: '尾帧图片' },
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
  const selectedStoryboardPromptSummary = selectedClip?.prompt?.trim() || '等待补充分镜提示词';

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
          <h2 className="text-sm font-semibold">创作配置</h2>
        </div>
      </div>

      {mode !== 'storyboard' && (
        <div className="mb-4 rounded-lg border border-border bg-background p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-medium">
                {mode === 'first_last_frame' ? '首尾帧素材' : '参考素材'}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {mode === 'first_last_frame'
                  ? '选择首帧、尾帧图片和背景音频；可一键对调首尾帧。'
                  : '可选择参考图片、参考视频与背景音频。'}
              </p>
            </div>
            {mode === 'first_last_frame' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={onSwapFirstLastFrame}
                disabled={!selectedClip}
              >
                <ArrowLeftRight className="size-3" />
                对调首尾帧
              </Button>
            )}
          </div>
          {selectedClip ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {materialSlots.map((slot) => (
                <MaterialSlot
                  key={slot.role}
                  label={slot.label}
                  material={selectedClip.materials.find((material) => material.role === slot.role) ?? null}
                  isChained={slot.role === 'first_frame' && selectedClip.chainFromPrev}
                  onClick={() => openPicker(slot.role)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-8 text-center text-xs text-muted-foreground">
              正在准备素材槽
            </div>
          )}
        </div>
      )}

      {mode === 'storyboard' && (
        <div className="mb-4 rounded-lg border border-border bg-background p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-medium">分镜脚本</h3>
              <p className="text-[11px] text-muted-foreground">生成或编辑每个分镜的标题、提示词和素材</p>
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
                新增分镜
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={onOpenTools}>
                <Wrench className="size-3" />
                生成分镜
              </Button>
            </div>
          </div>
          {clips.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-8 text-center text-xs text-muted-foreground">
              还没有分镜，可以新增分镜或选择 2/3/5/6/7/8 镜头预设。
            </div>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>连续时间轴</span>
                <span
                  className={cn(
                    timelineOverMax && 'text-destructive',
                  )}
                >
                  {storyboardDisplayTotalDuration}s · 上限 {STORYBOARD_TIMELINE_TOTAL_MAX_DURATION}s
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
                                alt={frame.material.name ?? clip.title ?? `分镜 ${clip.order}`}
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
                            aria-label={`删除${clip.title || `分镜 ${clip.order}`}`}
                          >
                            <Trash2 className="size-3" />
                          </button>
                          <div className="px-2 py-2">
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <span className="truncate text-xs font-medium">{clip.title || `分镜 ${clip.order}`}</span>
                            </div>
                            <p className="line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                              {clip.prompt || '等待补充镜头描述'}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-transparent transition-colors hover:bg-primary/35 focus:bg-primary/35 focus:outline-none"
                            aria-label={`调整${clip.title || `分镜 ${clip.order}`}时长`}
                            title="调整时长"
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
                <div className="mt-3 rounded-lg border border-border bg-card">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-accent"
                    aria-expanded={storyboardDetailOpen}
                    onClick={() => setStoryboardDetailOpen((open) => !open)}
                  >
                    <span className="min-w-0">
                      <span className="block text-xs font-medium">当前分镜详情</span>
                      <span className="mt-1 block line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                        分镜提示词：{selectedStoryboardPromptSummary}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                        {selectedClip.title || `分镜 ${selectedClip.order}`} · {selectedStoryboardMaterialCount > 0
                          ? `${selectedStoryboardMaterialCount} 个图片素材`
                          : '未添加图片'}
                      </span>
                    </span>
                    <ChevronDown
                      className={cn(
                        'size-3.5 shrink-0 text-muted-foreground transition-transform',
                        storyboardDetailOpen && 'rotate-180',
                      )}
                    />
                  </button>
                  {storyboardDetailOpen && (
                    <div className="space-y-3 border-t border-border p-3">
                      <label className="block space-y-1.5">
                        <span className="text-xs font-medium text-muted-foreground">镜头标题</span>
                        <ImeSafeInput
                          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary"
                          value={selectedClip.title ?? `分镜 ${selectedClip.order}`}
                          onValueChange={(value) => onTitleChange(selectedClip, value)}
                        />
                      </label>
                      <label className="block space-y-1.5">
                        <span className="text-xs font-medium text-muted-foreground">分镜提示词</span>
                        <ImeSafeTextarea
                          className="min-h-28 w-full resize-y rounded-md border border-border bg-background px-3 py-3 text-sm leading-6 outline-none placeholder:text-muted-foreground focus:border-primary"
                          placeholder="描述该分镜的主体、场景、镜头运动、节奏、光线、风格和关键动作。"
                          value={selectedClip.prompt ?? ''}
                          onValueChange={(value) => onPromptChange(selectedClip, value)}
                        />
                      </label>
                      <div className="space-y-2">
                        <div>
                          <h3 className="text-xs font-medium">分镜图片</h3>
                          <p className="text-[11px] text-muted-foreground">
                            可为当前分镜添加首帧、参考图或尾帧；接上一镜时首帧会自动使用上一镜尾帧。
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {storyboardDetailImageSlots.map((slot) => (
                            <MaterialSlot
                              key={slot.role}
                              label={slot.label}
                              material={selectedClip.materials.find((material) => material.role === slot.role) ?? null}
                              isChained={slot.role === 'first_frame' && selectedClip.chainFromPrev}
                              onClick={() => openPicker(slot.role, selectedClip.id)}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
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
                placeholder="描述主体、场景、镜头运动、节奏、光线、风格和关键动作。底部 chat 可以继续优化。"
                value={selectedClip.prompt ?? ''}
                onValueChange={(value) => onPromptChange(selectedClip, value)}
              />
            </label>
          )}
          {mode === 'storyboard' && (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">整片提示词</span>
              <ImeSafeTextarea
                className="min-h-28 w-full resize-y rounded-md border border-border bg-background px-3 py-3 text-sm leading-6 outline-none placeholder:text-muted-foreground focus:border-primary"
                placeholder="描述整支视频的主题、统一风格、镜头节奏、角色/产品和画面限制。"
                value={storyboardPrompt}
                onValueChange={onStoryboardPromptChange}
                onCommit={() => onStoryboardPromptBlur()}
              />
            </label>
          )}
          <PromptActionBar
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
          正在准备镜头编辑区...
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

function PromptActionBar({
  clip,
  canOptimize,
  optimizingPrompt,
  textModelId,
  textModels,
  textModelsLoading,
  modelConfigId,
  videoModels,
  videoModelsLoading,
  estimatedCost,
  estimatingCost,
  canGenerate: canGenerateOverride,
  onOptimizePrompt,
  onTextModelChange,
  onVideoModelChange,
  onGenerate,
}: {
  clip: VideoClip | null;
  canOptimize: boolean;
  optimizingPrompt: boolean;
  textModelId: string | null;
  textModels: ModelConfigItem[];
  textModelsLoading: boolean;
  modelConfigId: string;
  videoModels: ModelConfigItem[];
  videoModelsLoading: boolean;
  estimatedCost: number | null;
  estimatingCost: boolean;
  canGenerate?: boolean;
  onOptimizePrompt: () => void;
  onTextModelChange: (modelId: string | null) => void;
  onVideoModelChange: (modelId: string) => void;
  onGenerate: (clip: VideoClip) => void;
}) {
  const selectedTextModel = textModels.find((model) => model.id === textModelId);
  const selectedVideoModel = videoModels.find((model) => model.id === modelConfigId);
  const canGenerateSelectedClip = canGenerateOverride ?? (clip ? canGenerateClip(clip) : false);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background p-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-nowrap">
        {textModels.length > 0 ? (
          <ModelPickerPopover
            candidates={textModels}
            value={textModelId}
            onChange={onTextModelChange}
            labels={{
              searchPlaceholder: '搜索文本模型 / 供应商',
              empty: '没有匹配的文本模型',
            }}
            trigger={
              <button
                type="button"
                className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-card px-2.5 text-left text-xs transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60 sm:w-[178px]"
                disabled={optimizingPrompt}
              >
                <span className="flex min-w-0 flex-1 items-center gap-1.5">
                  <Sparkles className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">文本 · {selectedTextModel?.name ?? '默认'}</span>
                </span>
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
              </button>
            }
          />
        ) : (
          <button
            type="button"
            className="flex h-9 w-full items-center gap-1.5 rounded-md border border-dashed border-border bg-card px-2.5 text-left text-xs text-muted-foreground sm:w-[178px]"
            disabled
          >
            {textModelsLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            <span className="truncate">{textModelsLoading ? '加载文本模型' : '默认文本模型'}</span>
          </button>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 shrink-0 gap-1.5 px-3"
          disabled={!canOptimize}
          onClick={onOptimizePrompt}
        >
          {optimizingPrompt ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          AI 优化
        </Button>
      </div>

      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
        {videoModels.length > 0 ? (
          <ModelPickerPopover
            candidates={videoModels}
            value={modelConfigId}
            onChange={(id) => id && onVideoModelChange(id)}
            labels={{
              searchPlaceholder: '搜索视频模型 / 供应商',
              empty: '没有匹配的视频模型',
            }}
            trigger={
              <button
                type="button"
                className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-card px-2.5 text-left text-xs transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60 sm:w-[220px]"
                disabled={!clip || clip.status === 'generating'}
              >
                <span className="flex min-w-0 flex-1 items-center gap-1.5">
                  <Sparkles className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">视频 · {selectedVideoModel?.name ?? '选择模型'}</span>
                </span>
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
              </button>
            }
          />
        ) : (
          <button
            type="button"
            className="flex h-9 w-full items-center gap-1.5 rounded-md border border-dashed border-border bg-card px-2.5 text-left text-xs text-muted-foreground sm:w-[220px]"
            disabled
          >
            {videoModelsLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            <span className="truncate">{videoModelsLoading ? '加载视频模型' : '暂无视频模型'}</span>
          </button>
        )}

        <Button
          type="button"
          size="sm"
          className="h-9 shrink-0 gap-1.5 px-3"
          disabled={!clip || !canGenerateSelectedClip || clip.status === 'generating' || videoModels.length === 0}
          onClick={() => clip && onGenerate(clip)}
        >
          {clip?.status === 'generating' ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
          生成视频
          {estimatingCost ? (
            <Loader2 className="size-3 animate-spin opacity-80" />
          ) : estimatedCost != null ? (
            <span className="text-[11px] opacity-90">{estimatedCost} 积分</span>
          ) : null}
        </Button>
      </div>
    </div>
  );
}
