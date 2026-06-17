import { useState } from 'react';
import { ArrowLeftRight, ChevronDown, ImageIcon, Link2, Loader2, Play, Sparkles, Trash2, Wrench } from 'lucide-react';
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
const TIMELINE_CARD_MIN_WIDTH = 132;
const TIMELINE_RESIZE_STEP_PX = 44;

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
  onTextModelChange,
  modelConfigId,
  videoModels,
  videoModelsLoading,
  estimatedCost,
  estimatingCost,
  canGenerate: canGenerateOverride,
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
  onTextModelChange: (modelId: string | null) => void;
  modelConfigId: string;
  videoModels: ModelConfigItem[];
  videoModelsLoading: boolean;
  estimatedCost: number | null;
  estimatingCost: boolean;
  canGenerate?: boolean;
  onVideoModelChange: (modelId: string) => void;
  onGenerate: (clip: VideoClip) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerRole, setPickerRole] = useState<VideoMaterialTarget>('first_frame');
  const [pickerClipId, setPickerClipId] = useState<string | null>(null);
  const [resizingClip, setResizingClip] = useState<{ clipId: string; duration: number } | null>(null);
  const pickerClip = clips.find((clip) => clip.id === pickerClipId) ?? selectedClip;
  const optimizeSource = mode === 'storyboard' ? storyboardPrompt : selectedClip?.prompt;
  const canOptimize = Boolean(optimizeSource?.trim()) && !optimizingPrompt;
  const canGenerate = canGenerateOverride ?? (selectedClip ? canGenerateClip(selectedClip) : false);
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

  const handleDurationResizeStart = (event: React.PointerEvent<HTMLButtonElement>, clip: VideoClip) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startDuration = getClipDuration(clip, fallbackClipDuration);
    const otherDuration = storyboardTotalDuration - startDuration;
    let nextDuration = startDuration;
    setResizingClip({ clipId: clip.id, duration: startDuration });

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaSeconds = Math.round((moveEvent.clientX - startX) / TIMELINE_RESIZE_STEP_PX);
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
          <div className="mb-2 flex items-center justify-between gap-2">
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
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={onOpenTools}>
              <Wrench className="size-3" />
              生成分镜
            </Button>
          </div>
          {clips.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-8 text-center text-xs text-muted-foreground">
              还没有分镜，可以选择 2/3/5/6/7/8 镜头预设。
            </div>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>时间轴</span>
                <span
                  className={cn(
                    storyboardDisplayTotalDuration >= STORYBOARD_TIMELINE_TOTAL_MAX_DURATION && 'text-primary',
                  )}
                >
                  {storyboardDisplayTotalDuration}s / {STORYBOARD_TIMELINE_TOTAL_MAX_DURATION}s
                </span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {clips.map((clip) => {
                  const active = clip.id === selectedClipId;
                  const duration = resizingClip?.clipId === clip.id
                    ? resizingClip.duration
                    : getClipDuration(clip, fallbackClipDuration);
                  const frame = resolveTimelineFrame(clip, clips);
                  return (
                    <div
                      key={clip.id}
                      role="button"
                      tabIndex={0}
                      style={{ width: Math.max(TIMELINE_CARD_MIN_WIDTH, duration * TIMELINE_SECOND_WIDTH) }}
                      className={cn(
                        'group relative shrink-0 overflow-hidden rounded-md border bg-card text-left transition-colors',
                        active ? 'border-primary bg-primary/8' : 'border-border bg-card hover:bg-accent',
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
            </>
          )}
        </div>
      )}

      {selectedClip ? (
        <div className="space-y-3">
          {mode === 'storyboard' && (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">镜头标题</span>
              <input
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary"
                value={selectedClip.title ?? `分镜 ${selectedClip.order}`}
                onChange={(event) => onTitleChange(selectedClip, event.target.value)}
              />
            </label>
          )}
          {mode === 'storyboard' && (
            <div className="rounded-lg border border-border bg-background p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-medium">分镜图片</h3>
                  <p className="text-[11px] text-muted-foreground">
                    可为当前分镜添加首帧、参考图或尾帧；接上一镜时首帧会自动使用上一镜尾帧。
                  </p>
                </div>
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
          )}
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">{promptLabel}</span>
            <textarea
              className="min-h-36 w-full resize-y rounded-md border border-border bg-background px-3 py-3 text-sm leading-6 outline-none placeholder:text-muted-foreground focus:border-primary"
              placeholder="描述主体、场景、镜头运动、节奏、光线、风格和关键动作。底部 chat 可以继续优化。"
              value={selectedClip.prompt ?? ''}
              onChange={(event) => onPromptChange(selectedClip, event.target.value)}
            />
          </label>
          {mode === 'storyboard' && (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">整片提示词</span>
              <textarea
                className="min-h-28 w-full resize-y rounded-md border border-border bg-background px-3 py-3 text-sm leading-6 outline-none placeholder:text-muted-foreground focus:border-primary"
                placeholder="描述整支视频的主题、统一风格、镜头节奏、角色/产品和画面限制。"
                value={storyboardPrompt}
                onChange={(event) => onStoryboardPromptChange(event.target.value)}
                onBlur={onStoryboardPromptBlur}
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
  canGenerate,
  onOptimizePrompt,
  onTextModelChange,
  onVideoModelChange,
  onGenerate,
}: {
  clip: VideoClip;
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
  canGenerate: boolean;
  onOptimizePrompt: () => void;
  onTextModelChange: (modelId: string | null) => void;
  onVideoModelChange: (modelId: string) => void;
  onGenerate: (clip: VideoClip) => void;
}) {
  const selectedTextModel = textModels.find((model) => model.id === textModelId);
  const selectedVideoModel = videoModels.find((model) => model.id === modelConfigId);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background p-2">
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
              className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-border bg-card px-3 text-left text-xs transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60 sm:w-[210px]"
              disabled={optimizingPrompt}
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
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
          className="flex h-10 w-full items-center gap-2 rounded-md border border-dashed border-border bg-card px-3 text-left text-xs text-muted-foreground sm:w-[210px]"
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
        className="h-10 gap-1.5 px-3"
        disabled={!canOptimize}
        onClick={onOptimizePrompt}
      >
        {optimizingPrompt ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
        AI 优化
      </Button>

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
              className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-border bg-card px-3 text-left text-xs transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60 sm:w-[220px]"
              disabled={clip.status === 'generating'}
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
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
          className="flex h-10 w-full items-center gap-2 rounded-md border border-dashed border-border bg-card px-3 text-left text-xs text-muted-foreground sm:w-[220px]"
          disabled
        >
          {videoModelsLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          <span className="truncate">{videoModelsLoading ? '加载视频模型' : '暂无视频模型，请联系管理员配置'}</span>
        </button>
      )}

      <Button
        type="button"
        className="h-10 gap-1.5 px-4"
        disabled={!canGenerate || clip.status === 'generating' || videoModels.length === 0}
        onClick={() => onGenerate(clip)}
      >
        {clip.status === 'generating' ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
        生成视频
        {estimatingCost ? (
          <Loader2 className="size-3.5 animate-spin opacity-80" />
        ) : estimatedCost != null ? (
          <span className="text-xs opacity-90">{estimatedCost} 积分</span>
        ) : null}
      </Button>
    </div>
  );
}
