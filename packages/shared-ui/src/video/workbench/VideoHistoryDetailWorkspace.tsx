'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  Activity,
  ArrowLeft,
  Camera,
  Check,
  Clock3,
  Copy,
  ExternalLink,
  Film,
  ImagePlus,
  Loader2,
  RotateCcw,
  ScanLine,
  Share2,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  videoShareActions,
  videoWorkbenchActions,
  type VideoClip,
  type VideoClipGeneration,
  type VideoProject,
} from '@autix/shared-store';
import { toast } from 'sonner';
import { Button } from '../../ui/button';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import {
  StoryboardTimeline,
  getStoryboardActiveSegmentIndex,
  getStoryboardTotalDuration,
  type StoryboardTimelineSegment,
} from '../StoryboardTimeline';
import { useElementHeight } from '../useElementHeight';

interface ScreenshotPreview {
  url: string;
  file: File;
  time: number;
}

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

function clipDuration(clip: VideoClip) {
  const duration = Number(clip.params?.duration);
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

function buildSegments(clips: VideoClip[]): StoryboardTimelineSegment<VideoClip>[] {
  const hasDurations = clips.some((clip) => clipDuration(clip) > 0);
  let cursor = 0;
  return clips.map((clip) => {
    const duration = hasDurations ? clipDuration(clip) || 1 : 1;
    const segment = {
      id: clip.id,
      order: clip.order,
      title: clip.title,
      clip,
      start: cursor,
      end: cursor + duration,
      duration,
    };
    cursor += duration;
    return segment;
  });
}

function videoPoster(generation: VideoClipGeneration | null) {
  return generation?.thumbnailUrl ?? generation?.lastFrameUrl ?? null;
}

function formatSeconds(value: number) {
  return `${Math.max(0, Math.round(value))}s`;
}

function clampTime(value: number, duration: number) {
  return Math.min(Math.max(value, 0), Math.max(duration, 0));
}

function finiteMediaDuration(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function buildVideoShareUrl(token: string) {
  const path = `/share/video/${encodeURIComponent(token)}`;
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path}`;
}

export function VideoHistoryDetailWorkspace({
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoPanelRef = useRef<HTMLElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [screenshotPreview, setScreenshotPreview] = useState<ScreenshotPreview | null>(null);
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const [savingScreenshot, setSavingScreenshot] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const clips = useMemo(() => sortedClips(project), [project]);
  const segments = useMemo(() => buildSegments(clips), [clips]);
  const duration = getStoryboardTotalDuration(segments);
  const generation = latestCompletedGeneration(project);
  const poster = videoPoster(generation);
  const activeIndex = getStoryboardActiveSegmentIndex(segments, currentTime);
  const activeSegment = segments[activeIndex] ?? segments[0] ?? null;
  const hasStoryboard = segments.length > 1;
  const videoPanelHeight = useElementHeight(videoPanelRef);
  const sidePanelStyle = videoPanelHeight
    ? ({ height: videoPanelHeight, maxHeight: videoPanelHeight } as CSSProperties)
    : undefined;

  useEffect(() => {
    return () => {
      if (screenshotPreview) URL.revokeObjectURL(screenshotPreview.url);
    };
  }, [screenshotPreview]);

  const videoTimeToTimelineTime = useCallback((time: number, mediaDuration = videoDuration) => {
    const safeMediaDuration = finiteMediaDuration(mediaDuration);
    if (safeMediaDuration > 0 && duration > 0) {
      return clampTime((time / safeMediaDuration) * duration, duration);
    }
    return clampTime(time, duration);
  }, [duration, videoDuration]);

  const timelineTimeToVideoTime = useCallback((time: number) => {
    const nextTime = clampTime(time, duration);
    if (videoDuration > 0 && duration > 0) {
      return clampTime((nextTime / duration) * videoDuration, videoDuration);
    }
    return nextTime;
  }, [duration, videoDuration]);

  const seekToTime = useCallback((time: number) => {
    const video = videoRef.current;
    const nextTime = clampTime(time, duration);
    if (video) video.currentTime = timelineTimeToVideoTime(nextTime);
    setCurrentTime(nextTime);
  }, [duration, timelineTimeToVideoTime]);

  const closeScreenshotPreview = () => {
    setScreenshotPreview((preview) => {
      if (preview) URL.revokeObjectURL(preview.url);
      return null;
    });
  };

  const captureScreenshot = async () => {
    const video = videoRef.current;
    if (!video || !generation?.videoUrl) return;
    if (!video.videoWidth || !video.videoHeight) {
      toast.error(t('screenshotUnavailable'));
      return;
    }

    setScreenshotLoading(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas context unavailable');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((nextBlob) => {
          if (nextBlob) resolve(nextBlob);
          else reject(new Error('empty screenshot'));
        }, 'image/png');
      });
      closeScreenshotPreview();
      const time = currentTime;
      const file = new File(
        [blob],
        `video-snapshot-${project.id}-${Math.round(time)}s.png`,
        { type: 'image/png' },
      );
      setScreenshotPreview({
        file,
        time,
        url: URL.createObjectURL(blob),
      });
    } catch {
      toast.error(t('screenshotFailed'));
    } finally {
      setScreenshotLoading(false);
    }
  };

  const saveScreenshotToMaterials = async () => {
    if (!screenshotPreview) return;
    setSavingScreenshot(true);
    try {
      await videoWorkbenchActions.uploadScreenshotMaterial({
        file: screenshotPreview.file,
        title: t('screenshotTitle', { time: formatSeconds(screenshotPreview.time) }),
        sourceId: generation?.id ?? null,
        metadata: {
          projectId: project.id,
          generationId: generation?.id ?? null,
          capturedAtSeconds: screenshotPreview.time,
          clipId: activeSegment?.clip.id ?? null,
        },
      });
      toast.success(t('screenshotSaved'));
      closeScreenshotPreview();
    } catch {
      toast.error(t('screenshotSaveFailed'));
    } finally {
      setSavingScreenshot(false);
    }
  };

  const openShareDialog = async () => {
    setShareOpen(true);
    if (shareUrl || shareLoading) return;
    setShareLoading(true);
    try {
      const result = await videoShareActions.createShare(project.id);
      setShareUrl(buildVideoShareUrl(result.token));
    } catch {
      toast.error(t('shareCreateFailed'));
    } finally {
      setShareLoading(false);
    }
  };

  const copyShareUrl = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      toast.success(t('shareCopied'));
      window.setTimeout(() => setShareCopied(false), 1600);
    } catch {
      toast.error(t('shareCopyFailed'));
    }
  };

  return (
    <div className="flex h-full min-w-0 flex-col bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/95 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="sm" className="gap-2 px-2" onClick={onBack}>
            <ArrowLeft className="size-4" />
            {t('backToWorkspace')}
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">{project.title}</h1>
            <p className="truncate text-xs text-muted-foreground">{formatDate(project.updatedAt, locale)}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            disabled={!generation?.videoUrl || shareLoading}
            onClick={() => void openShareDialog()}
          >
            {shareLoading ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
            {t('share')}
          </Button>
          <Button size="sm" className="gap-2" onClick={() => onReuse(project.id)}>
            <RotateCcw className="size-4" />
            {t('reuse')}
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-muted/10 p-4">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
          <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section
              ref={videoPanelRef}
              className="min-w-0 overflow-hidden rounded-md border border-border bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
            >
              <div className="flex items-center justify-between border-b border-white/10 bg-black px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-white/55">
                <span className="inline-flex items-center gap-2">
                  <ScanLine className="size-3.5 text-primary" />
                  MONITOR
                </span>
                <div className="flex items-center gap-2">
                  <span>{formatSeconds(currentTime)} / {formatSeconds(duration)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 border border-white/10 bg-white/5 px-2 text-[11px] text-white/75 hover:bg-white/10 hover:text-white"
                    disabled={!generation?.videoUrl || screenshotLoading}
                    onClick={() => void captureScreenshot()}
                  >
                    {screenshotLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
                    {t('screenshot')}
                  </Button>
                </div>
              </div>
              {generation?.videoUrl ? (
                <video
                  ref={videoRef}
                  src={generation.videoUrl}
                  poster={poster ?? undefined}
                  controls
                  className="aspect-video w-full bg-black object-contain"
                  onTimeUpdate={(event) => {
                    setCurrentTime(videoTimeToTimelineTime(event.currentTarget.currentTime));
                  }}
                  onLoadedMetadata={(event) => {
                    const mediaDuration = finiteMediaDuration(event.currentTarget.duration);
                    setVideoDuration(mediaDuration);
                    setCurrentTime(videoTimeToTimelineTime(event.currentTarget.currentTime, mediaDuration));
                  }}
                  onDurationChange={(event) => {
                    setVideoDuration(finiteMediaDuration(event.currentTarget.duration));
                  }}
                />
              ) : poster ? (
                <img src={poster} alt="" className="aspect-video w-full bg-muted object-cover" />
              ) : (
                <div className="flex aspect-video w-full flex-col items-center justify-center bg-muted text-muted-foreground">
                  <Film className="mb-2 size-9" />
                  <span className="text-sm">{t('videoUnavailable')}</span>
                </div>
              )}
            </section>

            <aside className="min-w-0 self-stretch xl:min-h-0" style={sidePanelStyle}>
              <section className="flex h-full min-h-0 flex-col rounded-md border border-primary/25 bg-background p-4 shadow-[0_0_24px_rgba(255,255,255,0.04)]">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-primary">
                      <Activity className="size-3.5" />
                      SHOT DATA
                    </div>
                    <h2 className="mt-2 truncate text-base font-semibold">
                      {activeSegment?.clip.title || (activeSegment ? t('clipTitle', { order: activeSegment.clip.order }) : t('storyboard'))}
                    </h2>
                  </div>
                  {hasStoryboard && activeSegment && (
                    <span className="shrink-0 rounded border border-border bg-muted px-2 py-1 text-xs text-muted-foreground">
                      #{activeSegment.clip.order}
                    </span>
                  )}
                </div>

                {hasStoryboard && (
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-[11px] text-muted-foreground">{t('stats.clips')}</div>
                      <div className="mt-1 font-semibold">{clips.length}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground">{t('stats.duration')}</div>
                      <div className="mt-1 font-semibold">{activeSegment ? formatSeconds(activeSegment.duration) : '-'}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground">{t('timeRange')}</div>
                      <div className="mt-1 font-semibold">
                        {activeSegment ? `${formatSeconds(activeSegment.start)}-${formatSeconds(activeSegment.end)}` : '-'}
                      </div>
                    </div>
                  </div>
                )}

                <div className={hasStoryboard
                  ? 'mt-4 flex min-h-0 flex-1 flex-col border-t border-border pt-4'
                  : 'flex min-h-0 flex-1 flex-col'}
                >
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Clock3 className="size-3.5 text-primary" />
                    {t('storyboard')}
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                    <p className="text-sm leading-6 text-foreground/90">
                      {activeSegment?.clip.prompt || t('emptyPrompt')}
                    </p>
                  </div>
                </div>
              </section>
            </aside>
          </div>

          {hasStoryboard && (
            <StoryboardTimeline
              segments={segments}
              currentTime={currentTime}
              duration={duration}
              activeIndex={activeIndex}
              title={t('timeline')}
              activeLabel={activeSegment ? t('currentShot', {
                title: activeSegment.clip.title || t('clipTitle', { order: activeSegment.clip.order }),
              }) : undefined}
              durationLabel={formatSeconds(duration)}
              formatTime={formatSeconds}
              getSegmentTitle={(segment) => segment.clip.title || t('clipTitle', { order: segment.clip.order })}
              emptyLabel={t('emptyPrompt')}
              onSeek={seekToTime}
            />
          )}
        </div>
      </div>

      <Dialog
        open={Boolean(screenshotPreview)}
        onOpenChange={(open) => {
          if (!open) closeScreenshotPreview();
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="size-4" />
              {t('screenshotPreviewTitle')}
            </DialogTitle>
            <DialogDescription>{t('screenshotPreviewDescription')}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            {screenshotPreview && (
              <div className="overflow-hidden rounded-md border border-border bg-black">
                <img src={screenshotPreview.url} alt="" className="max-h-[60vh] w-full object-contain" />
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t('cancel')}
              </Button>
            </DialogClose>
            <Button
              type="button"
              className="gap-2"
              onClick={() => void saveScreenshotToMaterials()}
              disabled={savingScreenshot}
            >
              {savingScreenshot ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
              {t('saveScreenshot')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="size-4" />
              {t('shareDialogTitle')}
            </DialogTitle>
            <DialogDescription>{t('shareDialogDescription')}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2">
              <input
                readOnly
                value={shareLoading ? t('shareCreating') : shareUrl}
                className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none"
                aria-label={t('shareLinkLabel')}
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
                {shareCopied ? t('shareCopiedButton') : t('copyShareLink')}
              </Button>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">{t('shareDialogHint')}</p>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t('cancel')}
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
              {t('openSharePage')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
