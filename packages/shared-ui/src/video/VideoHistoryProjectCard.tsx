'use client';

import { useState } from 'react';
import {
  Check,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  Film,
  Loader2,
  Play,
  RotateCcw,
  Share2,
  Trash2,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  videoShareActions,
  type VideoClip,
  type VideoClipGeneration,
  type VideoProject,
} from '@autix/shared-store';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { cn } from '../ui/utils';

function buildVideoShareUrl(code: string) {
  const path = `/s/v/${encodeURIComponent(code)}`;
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path}`;
}

interface VideoHistoryProjectCardProps {
  project: VideoProject;
  compact?: boolean;
  onSelectProject: (projectId: string) => void;
  onReuseProject?: (projectId: string) => void;
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

function latestProjectGeneration(project: VideoProject) {
  return sortedClips(project)
    .flatMap((clip) => clip.generations ?? [])
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;
}

function resolveProjectDisplayStatus(project: VideoProject) {
  const latest = latestProjectGeneration(project);
  if (latest && ['pending', 'queued', 'running'].includes(latest.status)) return 'processing';
  if (latest?.status === 'failed' || latest?.status === 'expired') return 'failed';
  if (latest?.status === 'completed') return 'completed';
  return project.status;
}

function clipFrame(clip: VideoClip) {
  const generation = latestGeneration(clip);
  if (generation?.thumbnailUrl) return generation.thumbnailUrl;
  if (generation?.lastFrameUrl) return generation.lastFrameUrl;
  const imageMaterial = (clip.materials ?? []).find((material) =>
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
  onReuseProject,
  onDeleteProject,
}: VideoHistoryProjectCardProps) {
  const t = useTranslations('videoWorkbench.historyCard');
  const td = useTranslations('videoWorkbench.inspirationSheet.historyDetail');
  const locale = useLocale();
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
  const displayStatus = resolveProjectDisplayStatus(project);
  const chips = collectParamChips(project, clips);
  const projectPrompt = clips.find((clip) => clip.prompt?.trim())?.prompt?.trim() || t('noPrompt');

  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const openShareDialog = async () => {
    setShareOpen(true);
    if (shareUrl || shareLoading) return;
    setShareLoading(true);
    try {
      const result = await videoShareActions.createShare(project.id);
      setShareUrl(buildVideoShareUrl(result.code));
    } catch {
      toast.error(td('shareCreateFailed'));
    } finally {
      setShareLoading(false);
    }
  };

  const copyShareUrl = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      toast.success(td('shareCopied'));
      window.setTimeout(() => setShareCopied(false), 1600);
    } catch {
      toast.error(td('shareCopyFailed'));
    }
  };

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
          ) : latest?.videoUrl ? (
            <video
              src={latest.videoUrl}
              className="h-full w-full object-cover"
              muted
              playsInline
              preload="metadata"
              aria-label={project.title}
            />
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
                <span className="rounded bg-muted px-1.5 py-0.5 text-foreground">{statusLabel(displayStatus)}</span>
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

      <div className="grid grid-cols-2 border-y border-border bg-muted/12 text-[11px]">
        <div className="flex items-center justify-center gap-1.5 px-2 py-1.5">
          <span className="text-muted-foreground">{t('stats.clips')}</span>
          <span className="font-medium text-foreground">{clips.length}</span>
        </div>
        <div className="flex items-center justify-center gap-1.5 border-l border-border px-2 py-1.5">
          <span className="text-muted-foreground">{t('stats.materials')}</span>
          <span className="font-medium text-foreground">{materialCount}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
        <span className="inline-flex min-w-0 items-center gap-1 truncate text-[11px] text-muted-foreground">
          <Clock3 className="size-3 shrink-0" />
          {t('createdAt', { date: formatDate(project.createdAt, locale) })}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {latest?.videoUrl && (
            <>
              <button
                type="button"
                className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-md border border-border bg-background px-3 text-xs text-foreground transition-colors hover:border-primary/45 hover:bg-accent"
                aria-label={t('downloadVideo')}
                onClick={(event) => {
                  event.stopPropagation();
                  if (latest?.videoUrl) {
                    window.open(latest.videoUrl, '_blank', 'noopener,noreferrer');
                  }
                }}
              >
                <Download className="size-3.5" />
                {t('download')}
              </button>
              <button
                type="button"
                className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-md border border-border bg-background px-3 text-xs text-foreground transition-colors hover:border-primary/45 hover:bg-accent"
                onClick={() => void openShareDialog()}
                aria-label={t('share')}
              >
                {shareLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Share2 className="size-3.5" />}
                {t('share')}
              </button>
            </>
          )}
          <button
            type="button"
            className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-border bg-background px-3 text-xs text-foreground transition-colors hover:border-primary/45 hover:bg-accent"
            onClick={() => onSelectProject(project.id)}
          >
            {t('viewDetails')}
          </button>
          {onReuseProject && (
            <button
              type="button"
              className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-md bg-primary px-3 text-xs text-primary-foreground transition-colors hover:bg-primary/90"
              onClick={() => onReuseProject(project.id)}
            >
              <RotateCcw className="size-3.5" />
              {t('reuseProject')}
            </button>
          )}
        </div>
      </div>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="size-4" />
              {td('shareDialogTitle')}
            </DialogTitle>
            <DialogDescription>{td('shareDialogDescription')}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2">
              <input
                readOnly
                value={shareLoading ? td('shareCreating') : shareUrl}
                className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none"
                aria-label={td('shareLinkLabel')}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 gap-2"
                disabled={!shareUrl}
                onClick={() => void copyShareUrl()}
              >
                {shareCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {shareCopied ? td('shareCopiedButton') : td('copyShareLink')}
              </Button>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">{td('shareDialogHint')}</p>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {td('cancel')}
              </Button>
            </DialogClose>
            <Button
              type="button"
              className="gap-2"
              disabled={!shareUrl}
              onClick={() => {
                if (shareUrl) window.open(shareUrl, '_blank', 'noopener,noreferrer');
              }}
            >
              <ExternalLink className="size-4" />
              {td('openSharePage')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
