'use client';

import {
  Clock3,
  Film,
  ImageIcon,
  Layers,
  Play,
  Trash2,
} from 'lucide-react';
import type { VideoClip, VideoClipGeneration, VideoProject } from '@autix/shared-store';
import { cn } from '../ui/utils';
import { roleLabel } from './workbench/constants';

interface VideoHistoryProjectCardProps {
  project: VideoProject;
  compact?: boolean;
  onSelectProject: (projectId: string) => void;
  onDeleteProject?: (projectId: string) => void;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function sortedClips(project: VideoProject) {
  return [...(project.clips ?? [])].sort((a, b) => a.order - b.order);
}

function latestGeneration(clip: VideoClip) {
  return [...(clip.generations ?? [])]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;
}

function latestCompletedGeneration(project: VideoProject) {
  return sortedClips(project)
    .flatMap((clip) => clip.generations ?? [])
    .filter((generation) => generation.status === 'completed' && generation.videoUrl)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;
}

function clipFrame(clip: VideoClip) {
  const generation = latestGeneration(clip);
  if (generation?.thumbnailUrl) return generation.thumbnailUrl;
  if (generation?.lastFrameUrl) return generation.lastFrameUrl;
  const imageMaterial = clip.materials.find((material) =>
    ['first_frame', 'last_frame', 'reference_image'].includes(material.role),
  );
  return imageMaterial?.url ?? null;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusLabel(status: string) {
  if (status === 'completed') return '已完成';
  if (status === 'processing') return '生成中';
  if (status === 'failed') return '失败';
  if (status === 'draft') return '草稿';
  return status || '未知';
}

function numberParam(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function totalDuration(clips: VideoClip[]) {
  return clips.reduce((total, clip) => {
    const duration = numberParam(asRecord(clip.params).duration);
    return duration ? total + duration : total;
  }, 0);
}

function projectPrompt(clips: VideoClip[]) {
  const prompt = clips.find((clip) => clip.prompt?.trim())?.prompt?.trim();
  return prompt || '没有分镜提示词';
}

function collectParamChips(project: VideoProject, clips: VideoClip[]) {
  const firstParams = asRecord(clips[0]?.params);
  const latest = latestCompletedGeneration(project);
  const duration = totalDuration(clips);
  const model =
    latest?.model ||
    (typeof firstParams.model === 'string' ? firstParams.model : '') ||
    (typeof firstParams.modelConfigId === 'string' ? firstParams.modelConfigId : '');
  return [
    model,
    typeof firstParams.ratio === 'string' ? firstParams.ratio : null,
    typeof firstParams.resolution === 'string' ? firstParams.resolution : null,
    duration > 0 ? `${duration}s` : null,
    typeof firstParams.generationMode === 'string' ? firstParams.generationMode : null,
  ].filter((chip): chip is string => Boolean(chip));
}

function generationPreview(generation: VideoClipGeneration | null) {
  return generation?.thumbnailUrl ?? generation?.lastFrameUrl ?? null;
}

export function VideoHistoryProjectCard({
  project,
  compact = false,
  onSelectProject,
  onDeleteProject,
}: VideoHistoryProjectCardProps) {
  const clips = sortedClips(project);
  const latest = latestCompletedGeneration(project);
  const cover = project.coverImage ?? generationPreview(latest) ?? (clips[0] ? clipFrame(clips[0]) : null);
  const materialCount = clips.reduce((count, clip) => count + (clip.materials?.length ?? 0), 0);
  const generationCount = clips.reduce((count, clip) => count + (clip.generations?.length ?? 0), 0);
  const completedCount = clips.reduce(
    (count, clip) => count + (clip.generations ?? []).filter((generation) => generation.status === 'completed').length,
    0,
  );
  const chips = collectParamChips(project, clips);
  const visibleClips = clips.slice(0, compact ? 2 : 4);

  return (
    <article className="group overflow-hidden rounded-md border border-border bg-background transition-colors hover:border-primary/45">
      <div className="flex gap-3 p-3">
        <button
          type="button"
          className={cn(
            'relative shrink-0 overflow-hidden rounded-md bg-muted',
            compact ? 'size-16' : 'h-20 w-28',
          )}
          onClick={() => onSelectProject(project.id)}
          aria-label="打开历史项目"
        >
          {cover ? (
            <img src={cover} alt={project.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Film className="size-6 text-muted-foreground" />
            </div>
          )}
          {latest?.videoUrl && (
            <span className="absolute bottom-1 right-1 inline-flex size-5 items-center justify-center rounded-full bg-black/65 text-white">
              <Play className="size-3 fill-current" />
            </span>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="rounded bg-muted px-1.5 py-0.5 text-foreground">{statusLabel(project.status)}</span>
                <span className="truncate">{formatDate(project.updatedAt)}</span>
              </div>
              <p className="mt-1 truncate text-sm font-medium">{project.title}</p>
            </div>
            {onDeleteProject && (
              <button
                type="button"
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 group-focus-within:opacity-100"
                onClick={() => onDeleteProject(project.id)}
                title="删除历史项目"
                aria-label="删除历史项目"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>

          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {projectPrompt(clips)}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {chips.map((chip, index) => (
              <span key={`${chip}-${index}`} className="max-w-full truncate rounded border border-border bg-muted/35 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {chip}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 border-y border-border bg-muted/12 text-center text-[11px]">
        <div className="px-2 py-2">
          <div className="font-medium text-foreground">{clips.length}</div>
          <div className="text-muted-foreground">分镜</div>
        </div>
        <div className="border-x border-border px-2 py-2">
          <div className="font-medium text-foreground">{materialCount}</div>
          <div className="text-muted-foreground">素材</div>
        </div>
        <div className="px-2 py-2">
          <div className="font-medium text-foreground">{completedCount}/{generationCount}</div>
          <div className="text-muted-foreground">结果</div>
        </div>
      </div>

      {visibleClips.length > 0 && (
        <div className="space-y-1.5 p-2">
          {visibleClips.map((clip) => {
            const frame = clipFrame(clip);
            const generation = latestGeneration(clip);
            const clipMaterials = clip.materials ?? [];
            return (
              <div key={clip.id} className="flex items-center gap-2 rounded-md border border-border bg-muted/12 p-1.5">
                <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                  {frame ? (
                    <img src={frame} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="size-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium">
                    {clip.title || `分镜 ${clip.order}`}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {clip.prompt || '等待补充分镜描述'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                  {clipMaterials[0] && (
                    <span className="hidden max-w-16 truncate sm:inline">{roleLabel(clipMaterials[0].role, {
                      firstFrame: '首帧',
                      lastFrame: '尾帧',
                      referenceImage: '参考图',
                      referenceVideo: '参考视频',
                      referenceAudio: '背景音频',
                    })}</span>
                  )}
                  {generation && (
                    <span className="rounded bg-background px-1.5 py-0.5">{statusLabel(generation.status)}</span>
                  )}
                </div>
              </div>
            );
          })}
          {clips.length > visibleClips.length && (
            <div className="flex items-center justify-center gap-1 rounded-md border border-dashed border-border py-1.5 text-[10px] text-muted-foreground">
              <Layers className="size-3" />
              还有 {clips.length - visibleClips.length} 个分镜
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
        <span className="inline-flex min-w-0 items-center gap-1 truncate text-[11px] text-muted-foreground">
          <Clock3 className="size-3 shrink-0" />
          创建于 {formatDate(project.createdAt)}
        </span>
        <button
          type="button"
          className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-border bg-background px-3 text-xs text-foreground transition-colors hover:border-primary/45 hover:bg-accent"
          onClick={() => onSelectProject(project.id)}
        >
          打开项目
        </button>
      </div>
    </article>
  );
}
