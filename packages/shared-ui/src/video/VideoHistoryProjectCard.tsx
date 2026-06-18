'use client';

import { useMemo } from 'react';
import {
  Clock3,
  Film,
  ImageIcon,
  Layers,
  Play,
  Trash2,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
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

function formatDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
  const t = useTranslations('videoWorkbench.historyCard');
  const tMaterialTargets = useTranslations('videoWorkbench.materialTargets');
  const locale = useLocale();
  const materialTargetMessages = useMemo(
    () => ({
      firstFrame: tMaterialTargets('firstFrame'),
      lastFrame: tMaterialTargets('lastFrame'),
      referenceImage: tMaterialTargets('referenceImage'),
      referenceVideo: tMaterialTargets('referenceVideo'),
      referenceAudio: tMaterialTargets('referenceAudio'),
    }),
    [tMaterialTargets],
  );
  const statusLabel = (status: string) => {
    if (status === 'completed') return t('status.completed');
    if (status === 'processing') return t('status.processing');
    if (status === 'failed') return t('status.failed');
    if (status === 'draft') return t('status.draft');
    return status || t('status.unknown');
  };
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
  const projectPrompt = clips.find((clip) => clip.prompt?.trim())?.prompt?.trim() || t('noPrompt');

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
          aria-label={t('openProjectAria')}
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
                <span className="truncate">{formatDate(project.updatedAt, locale)}</span>
              </div>
              <p className="mt-1 truncate text-sm font-medium">{project.title}</p>
            </div>
            {onDeleteProject && (
              <button
                type="button"
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 group-focus-within:opacity-100"
                onClick={() => onDeleteProject(project.id)}
                title={t('deleteProject')}
                aria-label={t('deleteProject')}
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>

          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {projectPrompt}
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
          <div className="text-muted-foreground">{t('stats.clips')}</div>
        </div>
        <div className="border-x border-border px-2 py-2">
          <div className="font-medium text-foreground">{materialCount}</div>
          <div className="text-muted-foreground">{t('stats.materials')}</div>
        </div>
        <div className="px-2 py-2">
          <div className="font-medium text-foreground">{completedCount}/{generationCount}</div>
          <div className="text-muted-foreground">{t('stats.results')}</div>
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
                    {clip.title || t('clipDefaultTitle', { order: clip.order })}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {clip.prompt || t('clipPlaceholder')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                  {clipMaterials[0] && (
                    <span className="hidden max-w-16 truncate sm:inline">{roleLabel(clipMaterials[0].role, materialTargetMessages)}</span>
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
              {t('moreClips', { count: clips.length - visibleClips.length })}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
        <span className="inline-flex min-w-0 items-center gap-1 truncate text-[11px] text-muted-foreground">
          <Clock3 className="size-3 shrink-0" />
          {t('createdAt', { date: formatDate(project.createdAt, locale) })}
        </span>
        <button
          type="button"
          className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-border bg-background px-3 text-xs text-foreground transition-colors hover:border-primary/45 hover:bg-accent"
          onClick={() => onSelectProject(project.id)}
        >
          {t('openProject')}
        </button>
      </div>
    </article>
  );
}
