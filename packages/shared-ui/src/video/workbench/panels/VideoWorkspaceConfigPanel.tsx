import { useState } from 'react';
import { ArrowLeftRight, Loader2, Sparkles, Wrench } from 'lucide-react';
import type { VideoClip } from '@autix/shared-store';
import { Button } from '../../../ui/button';
import { cn } from '../../../ui/utils';
import { MaterialPicker } from '../../MaterialPicker';
import { MaterialSlot } from '../../MaterialSlot';
import { clipParams, type VideoMaterialTarget, type VideoWorkspaceMode } from '../constants';

export function VideoWorkspaceConfigPanel({
  mode,
  clips,
  selectedClip,
  selectedClipId,
  generatingCount,
  projectId,
  onSelectClip,
  onOpenTools,
  onOpenStoryboardTool,
  onPromptChange,
  onTitleChange,
  onOptimizePrompt,
  optimizingPrompt,
  onSwapFirstLastFrame,
}: {
  mode: VideoWorkspaceMode;
  clips: VideoClip[];
  selectedClip: VideoClip | null;
  selectedClipId: string | null;
  generatingCount: number;
  projectId: string;
  onSelectClip: (clipId: string | null) => void;
  onOpenTools: () => void;
  onOpenStoryboardTool: (prompt?: string) => void;
  onPromptChange: (clip: VideoClip, prompt: string) => void;
  onTitleChange: (clip: VideoClip, title: string) => void;
  onOptimizePrompt: () => void;
  optimizingPrompt: boolean;
  onSwapFirstLastFrame: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerRole, setPickerRole] = useState<VideoMaterialTarget>('first_frame');
  const selectedParams = clipParams(selectedClip);
  const canOptimize = Boolean(selectedClip?.prompt?.trim()) && !optimizingPrompt;
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
  const openPicker = (role: VideoMaterialTarget) => {
    setPickerRole(role);
    setPickerOpen(true);
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
              <p className="text-[11px] text-muted-foreground">从视频创意和右侧参数生成对应数量的分镜脚本</p>
            </div>
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={onOpenTools}>
              <Wrench className="size-3" />
              生成分镜
            </Button>
          </div>
          {clips.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-8 text-center text-xs text-muted-foreground">
              还没有分镜，可以从 Tools 选择 3/5/6/8 镜头预设。
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {clips.map((clip) => {
                const active = clip.id === selectedClipId;
                const duration = Number(clipParams(clip).duration ?? 5);
                return (
                  <button
                    key={clip.id}
                    type="button"
                    className={cn(
                      'min-w-[170px] rounded-md border px-3 py-2 text-left transition-colors',
                      active ? 'border-primary bg-primary/8' : 'border-border bg-card hover:bg-accent',
                    )}
                    onClick={() => onSelectClip(clip.id)}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium">{clip.title || `分镜 ${clip.order}`}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{duration}s</span>
                    </div>
                    <p className="line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                      {clip.prompt || '等待补充镜头描述'}
                    </p>
                  </button>
                );
              })}
            </div>
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
          <label className="block space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">{promptLabel}</span>
              <div className="flex items-center gap-2">
                {mode === 'storyboard' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 px-2 text-xs"
                    onClick={() => onOpenStoryboardTool(selectedClip.prompt ?? '')}
                  >
                    <Wrench className="size-3" />
                    生成分镜
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-xs"
                  disabled={!canOptimize}
                  onClick={onOptimizePrompt}
                >
                  {optimizingPrompt ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                  AI 优化
                </Button>
              </div>
            </div>
            <textarea
              className="min-h-36 w-full resize-y rounded-md border border-border bg-background px-3 py-3 text-sm leading-6 outline-none placeholder:text-muted-foreground focus:border-primary"
              placeholder="描述主体、场景、镜头运动、节奏、光线、风格和关键动作。底部 chat 可以继续优化。"
              value={selectedClip.prompt ?? ''}
              onChange={(event) => onPromptChange(selectedClip, event.target.value)}
            />
          </label>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{String(selectedParams.resolution ?? '1080p')}</span>
            <span>{String(selectedParams.ratio ?? '16:9')}</span>
            <span>{String(selectedParams.duration ?? 5)}s</span>
            {generatingCount > 0 && <span>{generatingCount} 个任务生成中</span>}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
          正在准备镜头编辑区...
        </div>
      )}

      {selectedClip && mode !== 'storyboard' && (
        <MaterialPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          role={pickerRole}
          clipId={selectedClip.id}
          projectId={projectId}
        />
      )}
    </section>
  );
}
