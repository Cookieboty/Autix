'use client';

import { ArrowLeft, Clock3, Film, RotateCcw } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { VideoClip, VideoClipGeneration, VideoProject } from '@autix/shared-store';
import { Button } from '../../../ui/button';

function sortedClips(project: VideoProject) {
  return [...(project.clips ?? [])].sort((a, b) => a.order - b.order);
}

function latestProjectGeneration(project: VideoProject) {
  return sortedClips(project)
    .flatMap((clip) => clip.generations ?? [])
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;
}

function latestCompletedGeneration(project: VideoProject) {
  const generation = latestProjectGeneration(project);
  return generation?.status === 'completed' && generation.videoUrl ? generation : null;
}

function formatDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function durationOf(clip: VideoClip) {
  const duration = Number(clip.params?.duration);
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

function totalDuration(clips: VideoClip[]) {
  return Math.ceil(clips.reduce((sum, clip) => sum + durationOf(clip), 0));
}

function videoPoster(generation: VideoClipGeneration | null) {
  return generation?.thumbnailUrl ?? generation?.lastFrameUrl ?? null;
}

export function VideoHistoryProjectDetail({
  project,
  onBack,
  onReuse,
}: {
  project: VideoProject;
  onBack: () => void;
  onReuse: (projectId: string) => void;
}) {
  const t = useTranslations('videoWorkbench.inspirationSheet.historyDetail');
  const locale = useLocale();
  const clips = sortedClips(project);
  const generation = latestCompletedGeneration(project);
  const poster = videoPoster(generation);
  const duration = totalDuration(clips);
  const materialCount = clips.reduce((count, clip) => count + (clip.materials?.length ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" className="gap-2 px-2" onClick={onBack}>
          <ArrowLeft className="size-4" />
          {t('back')}
        </Button>
        <Button size="sm" className="gap-2" onClick={() => onReuse(project.id)}>
          <RotateCcw className="size-4" />
          {t('reuse')}
        </Button>
      </div>

      <section className="space-y-3">
        <div>
          <p className="text-xs text-muted-foreground">{formatDate(project.updatedAt, locale)}</p>
          <h3 className="mt-1 text-base font-semibold text-foreground">{project.title}</h3>
        </div>

        <div className="overflow-hidden rounded-md border border-border bg-muted/20">
          {generation?.videoUrl ? (
            <video
              src={generation.videoUrl}
              poster={poster ?? undefined}
              controls
              className="aspect-video w-full bg-black object-contain"
            />
          ) : poster ? (
            <img src={poster} alt="" className="aspect-video w-full bg-muted object-cover" />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center bg-muted">
              <Film className="size-8 text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 rounded-md border border-border text-center text-xs">
          <div className="p-2">
            <div className="font-semibold text-foreground">{clips.length}</div>
            <div className="text-muted-foreground">{t('stats.clips')}</div>
          </div>
          <div className="border-x border-border p-2">
            <div className="font-semibold text-foreground">{duration > 0 ? `${duration}s` : '-'}</div>
            <div className="text-muted-foreground">{t('stats.duration')}</div>
          </div>
          <div className="p-2">
            <div className="font-semibold text-foreground">{materialCount}</div>
            <div className="text-muted-foreground">{t('stats.materials')}</div>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Clock3 className="size-4 text-primary" />
          {t('storyboard')}
        </div>
        <div className="space-y-2">
          {clips.map((clip) => (
            <article key={clip.id} className="rounded-md border border-border bg-background p-3">
              <div className="flex items-center justify-between gap-3">
                <h4 className="min-w-0 truncate text-sm font-medium">
                  {clip.title || t('clipTitle', { order: clip.order })}
                </h4>
                {durationOf(clip) > 0 && (
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    {durationOf(clip)}s
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {clip.prompt || t('emptyPrompt')}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
