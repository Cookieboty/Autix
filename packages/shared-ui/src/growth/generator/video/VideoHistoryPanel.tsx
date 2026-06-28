'use client';

import { useEffect, useRef } from 'react';
import { Clock3, Film, Image as ImageIcon, Loader2, PlayCircle, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useVideoProjectStore, type VideoProject } from '@autix/shared-store';

export type PendingVideoGenerationCard = {
  id: string;
  title: string;
  prompt: string;
  model: string;
  coverUrl?: string | null;
};

interface VideoHistoryPanelProps {
  pending?: PendingVideoGenerationCard | null;
  onSelectProject: (project: VideoProject) => void;
}

function getLatestGeneration(project: VideoProject) {
  return (project.clips ?? [])
    .flatMap((clip) => clip.generations ?? [])
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;
}

function getProjectCover(project: VideoProject) {
  const latest = getLatestGeneration(project);
  const firstMaterial = project.clips
    .flatMap((clip) => clip.materials ?? [])
    .find((material) => material.url);
  return (
    latest?.thumbnailUrl ??
    latest?.lastFrameUrl ??
    project.coverImage ??
    firstMaterial?.url ??
    null
  );
}

function getProjectVideoUrl(project: VideoProject) {
  return (project.clips ?? [])
    .flatMap((clip) => clip.generations ?? [])
    .filter((generation) => generation.status === 'completed' && generation.videoUrl)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
    ?.videoUrl ?? null;
}

function getProjectStatus(project: VideoProject) {
  const generations = (project.clips ?? []).flatMap((clip) => clip.generations ?? []);
  if (generations.some((generation) => generation.status === 'completed' && generation.videoUrl)) {
    return 'completed';
  }
  if (generations.some((generation) => ['pending', 'queued', 'running', 'processing', 'generating'].includes(generation.status))) {
    return 'processing';
  }
  if (generations.some((generation) => generation.status === 'failed')) {
    return 'failed';
  }
  return project.status || 'draft';
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function VideoHistoryPanel({ pending, onSelectProject }: VideoHistoryPanelProps) {
  const t = useTranslations('publicGrowth.generator.studio');
  const projects = useVideoProjectStore((s) => s.projects);
  const loading = useVideoProjectStore((s) => s.loading);
  const loadProjects = useVideoProjectStore((s) => s.loadProjects);

  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    void loadProjects();
  }, [loadProjects]);

  if (loading && projects.length === 0 && !pending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (projects.length === 0 && !pending) {
    return (
      <div className="growth-flow-border relative overflow-hidden rounded-[14px] border border-dashed border-border bg-secondary p-8 text-center">
        <div className="growth-scan pointer-events-none absolute inset-x-0 top-0 h-20 opacity-20" />
        <div className="relative mx-auto grid size-12 place-items-center rounded-full border border-border bg-card text-foreground/48">
          <Film className="size-5" />
        </div>
        <h2 className="relative mt-3 text-sm font-black uppercase text-foreground">
          {t('emptyVideoHistory')}
        </h2>
        <p className="relative mx-auto mt-2 max-w-sm text-xs font-semibold leading-5 text-foreground/44">
          {t('emptyVideoHistoryHint')}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {pending ? <PendingVideoCard pending={pending} /> : null}
      {projects.map((project) => {
        const cover = getProjectCover(project);
        const videoUrl = getProjectVideoUrl(project);
        const status = getProjectStatus(project);
        const clipCount = project.clips?.length ?? 0;
        return (
          <button
            key={project.id}
            type="button"
            onClick={() => onSelectProject(project)}
            className="growth-generator-video-card group relative overflow-hidden rounded-[14px] border border-border bg-background text-left transition duration-300 hover:-translate-y-0.5 hover:border-input"
          >
            <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
              {videoUrl ? (
                <video
                  src={videoUrl}
                  poster={cover ?? undefined}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover opacity-90 transition duration-700 group-hover:scale-[1.04]"
                  onMouseEnter={(event) => void event.currentTarget.play().catch(() => undefined)}
                  onMouseLeave={(event) => {
                    event.currentTarget.pause();
                    event.currentTarget.currentTime = 0;
                  }}
                />
              ) : cover ? (
                <img
                  src={cover}
                  alt={project.title}
                  className="h-full w-full object-cover opacity-88 transition duration-700 group-hover:scale-[1.04]"
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-foreground/36">
                  <ImageIcon className="size-10" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/16 to-background/84" />
              <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-background/58 px-2 py-1 text-[10px] font-black uppercase text-foreground/82 backdrop-blur-md">
                <Sparkles className="size-3 text-growth-accent" />
                {t(`videoStatus.${status}`)}
              </div>
              <span className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-foreground/88 text-background opacity-0 shadow-lg transition group-hover:opacity-100">
                <PlayCircle className="size-4" />
              </span>
              <div className="absolute inset-x-0 bottom-0 p-3">
                <h3 className="line-clamp-2 text-base font-black leading-tight text-foreground">
                  {project.title}
                </h3>
                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] font-bold text-foreground/52">
                  <span className="inline-flex items-center gap-1">
                    <Film className="size-3" />
                    {t('clipCount', { count: clipCount })}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="size-3" />
                    {formatDate(project.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function PendingVideoCard({ pending }: { pending: PendingVideoGenerationCard }) {
  const t = useTranslations('publicGrowth.generator.studio');

  return (
    <article
      className="growth-flow-border growth-generator-video-card relative overflow-hidden rounded-[14px] border border-growth-accent/35 bg-background text-left growth-history-card-shadow"
      aria-live="polite"
      aria-label={t('generating')}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
        {pending.coverUrl ? (
          <img
            src={pending.coverUrl}
            alt={pending.title}
            className="h-full w-full object-cover opacity-40 blur-[1px] scale-[1.02]"
          />
        ) : null}
        <div className="absolute inset-0 growth-history-empty-bg" />
        <div className="growth-scan pointer-events-none absolute inset-x-0 top-0 h-24 opacity-30" />
        <div className="absolute inset-3 rounded-[12px] border border-border/60 bg-background/20 backdrop-blur-sm" />
        <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-background/58 px-2 py-1 text-[10px] font-black uppercase text-foreground/82 backdrop-blur-md">
          <Sparkles className="size-3 text-growth-accent" />
          {t('videoStatus.processing')}
        </div>
        <div className="absolute inset-x-0 top-[34%] flex flex-col items-center px-5 text-center">
          <span className="relative grid size-14 place-items-center rounded-full border border-growth-accent/40 bg-growth-accent/10 text-growth-accent growth-history-icon-glow">
            <span className="absolute inset-2 rounded-full border border-growth-accent/35 border-t-transparent animate-spin" />
            <Film className="size-5" />
          </span>
          <h2 className="mt-4 text-base font-black uppercase leading-none text-foreground">
            {t('generating')}
          </h2>
          <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-foreground/50">
            {pending.prompt}
          </p>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-3">
          <div className="mb-3 grid grid-cols-4 gap-1.5">
            {Array.from({ length: 4 }).map((_, index) => (
              <span
                key={index}
                className="growth-clip-pulse h-1.5 rounded-full bg-growth-accent/70"
                style={{ animationDelay: `${index * 120}ms` }}
              />
            ))}
          </div>
          <h3 className="line-clamp-1 text-base font-black leading-tight text-foreground">
            {pending.title}
          </h3>
          <div className="mt-1 truncate text-[11px] font-bold text-foreground/48">
            {pending.model}
          </div>
        </div>
      </div>
    </article>
  );
}
