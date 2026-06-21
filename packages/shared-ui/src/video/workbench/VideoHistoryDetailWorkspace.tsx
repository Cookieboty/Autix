'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Activity, ArrowLeft, Camera, Clock3, Film, ImagePlus, Loader2, RotateCcw, ScanLine } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { videoWorkbenchActions, type VideoClip, type VideoClipGeneration, type VideoProject } from '@autix/shared-store';
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
import { cn } from '../../ui/utils';

interface StoryboardSegment {
  clip: VideoClip;
  start: number;
  end: number;
  duration: number;
}

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

function buildSegments(clips: VideoClip[]): StoryboardSegment[] {
  const hasDurations = clips.some((clip) => clipDuration(clip) > 0);
  let cursor = 0;
  return clips.map((clip) => {
    const duration = hasDurations ? clipDuration(clip) || 1 : 1;
    const segment = {
      clip,
      start: cursor,
      end: cursor + duration,
      duration,
    };
    cursor += duration;
    return segment;
  });
}

function totalDuration(segments: StoryboardSegment[]) {
  return Math.ceil(segments.reduce((sum, segment) => sum + segment.duration, 0));
}

function videoPoster(generation: VideoClipGeneration | null) {
  return generation?.thumbnailUrl ?? generation?.lastFrameUrl ?? null;
}

function activeSegmentIndex(segments: StoryboardSegment[], currentTime: number) {
  if (segments.length === 0) return -1;
  const hit = segments.findIndex((segment) => currentTime >= segment.start && currentTime < segment.end);
  return hit >= 0 ? hit : segments.length - 1;
}

function formatSeconds(value: number) {
  return `${Math.max(0, Math.round(value))}s`;
}

function progressPercent(currentTime: number, duration: number) {
  if (!Number.isFinite(currentTime) || duration <= 0) return 0;
  return Math.min(100, Math.max(0, (currentTime / duration) * 100));
}

function clampTime(value: number, duration: number) {
  return Math.min(Math.max(value, 0), Math.max(duration, 0));
}

function finiteMediaDuration(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0;
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
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const scrubStartXRef = useRef(0);
  const didDragTimelineRef = useRef(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [screenshotPreview, setScreenshotPreview] = useState<ScreenshotPreview | null>(null);
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const [savingScreenshot, setSavingScreenshot] = useState(false);
  const clips = useMemo(() => sortedClips(project), [project]);
  const segments = useMemo(() => buildSegments(clips), [clips]);
  const duration = totalDuration(segments);
  const generation = latestCompletedGeneration(project);
  const poster = videoPoster(generation);
  const activeIndex = activeSegmentIndex(segments, currentTime);
  const activeSegment = segments[activeIndex] ?? segments[0] ?? null;
  const timelineProgress = progressPercent(currentTime, duration);

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

  const seekToSegment = (segment: StoryboardSegment) => {
    seekToTime(segment.start);
  };

  const seekFromPointer = useCallback((clientX: number) => {
    const track = timelineRef.current;
    if (!track || duration <= 0) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    seekToTime(duration * ratio);
  }, [duration, seekToTime]);

  const endScrubbing = (event: ReactPointerEvent<HTMLDivElement>) => {
    setIsScrubbing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    window.setTimeout(() => {
      didDragTimelineRef.current = false;
    }, 0);
  };

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
        <Button size="sm" className="shrink-0 gap-2" onClick={() => onReuse(project.id)}>
          <RotateCcw className="size-4" />
          {t('reuse')}
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-muted/10 p-4">
        <div className="mx-auto grid w-full max-w-7xl gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <main className="min-w-0 space-y-3">
            <section className="overflow-hidden rounded-md border border-border bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
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

            <section className="relative overflow-hidden rounded-md border border-primary/20 bg-background p-2 shadow-[0_0_24px_rgba(255,255,255,0.04)]">
              <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(to_right,rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.05)_1px,transparent_1px)] [background-size:42px_42px]" />
              <div className="relative mb-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-primary">
                    <ScanLine className="size-3.5" />
                    {t('timeline')}
                  </div>
                  {activeSegment && (
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {t('currentShot', {
                        title: activeSegment.clip.title || t('clipTitle', { order: activeSegment.clip.order }),
                      })}
                    </p>
                  )}
                </div>
                <span className="shrink-0 rounded border border-primary/25 bg-primary/10 px-2 py-1 text-[11px] text-primary">
                  {formatSeconds(duration)}
                </span>
              </div>

              <div
                ref={timelineRef}
                role="slider"
                tabIndex={0}
                aria-label={t('timeline')}
                aria-valuemin={0}
                aria-valuemax={duration}
                aria-valuenow={Math.round(currentTime)}
                className={cn(
                  'relative cursor-ew-resize rounded-md border border-border bg-black/45 p-2 outline-none ring-primary/40 focus-visible:ring-2',
                  isScrubbing && 'border-primary/50',
                )}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  scrubStartXRef.current = event.clientX;
                  didDragTimelineRef.current = false;
                  setIsScrubbing(true);
                  seekFromPointer(event.clientX);
                }}
                onPointerMove={(event) => {
                  if (!isScrubbing) return;
                  if (Math.abs(event.clientX - scrubStartXRef.current) > 3) {
                    didDragTimelineRef.current = true;
                  }
                  seekFromPointer(event.clientX);
                }}
                onPointerUp={endScrubbing}
                onPointerCancel={endScrubbing}
                onLostPointerCapture={() => setIsScrubbing(false)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowLeft') {
                    event.preventDefault();
                    seekToTime(currentTime - 1);
                  }
                  if (event.key === 'ArrowRight') {
                    event.preventDefault();
                    seekToTime(currentTime + 1);
                  }
                }}
              >
                <div className="relative flex h-4 items-end justify-between border-b border-white/10 pb-1 text-[10px] text-muted-foreground">
                  {Array.from({ length: 6 }, (_, index) => {
                    const tick = Math.round((duration * index) / 5);
                    return (
                      <span key={index} className="relative flex min-w-0 flex-col items-center gap-1">
                        <span className="h-2 w-px bg-white/25" />
                        <span>{formatSeconds(tick)}</span>
                      </span>
                    );
                  })}
                </div>

                <div className="relative mt-2 h-10">
                  <div
                    className="pointer-events-none absolute -top-2 bottom-0 z-20 w-px bg-primary shadow-[0_0_16px_rgba(255,255,255,0.55)]"
                    style={{ left: `${timelineProgress}%` }}
                  >
                    <span className="absolute -left-2 -top-1.5 size-4 rotate-45 border border-primary bg-background shadow-[0_0_12px_rgba(255,255,255,0.45)]" />
                  </div>
                  <div className="flex h-full gap-1">
                    {segments.map((segment, index) => (
                      <button
                        key={segment.clip.id}
                        type="button"
                        className={cn(
                          'group relative min-w-14 overflow-hidden rounded-sm border px-2 py-1.5 text-left transition-all',
                          index === activeIndex
                            ? 'border-primary bg-primary/25 shadow-[0_0_18px_rgba(255,255,255,0.16)]'
                            : index < activeIndex
                              ? 'border-primary/35 bg-primary/12'
                              : 'border-white/10 bg-white/[0.06] hover:border-primary/40 hover:bg-white/[0.09]',
                        )}
                        style={{ flexGrow: segment.duration, flexBasis: 0 }}
                        onClick={() => {
                          if (didDragTimelineRef.current) return;
                          seekToSegment(segment);
                        }}
                        aria-label={segment.clip.title || t('clipTitle', { order: segment.clip.order })}
                      >
                        <span className="absolute inset-x-0 top-0 h-px bg-white/20" />
                        <span className="absolute inset-x-1 top-1 flex justify-between text-[10px] text-muted-foreground">
                          <span>#{segment.clip.order}</span>
                          <span>{formatSeconds(segment.duration)}</span>
                        </span>
                        <span className="absolute inset-x-2 bottom-1.5 truncate text-[11px] font-medium text-foreground/85">
                          {segment.clip.title || t('clipTitle', { order: segment.clip.order })}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </main>

          <aside className="min-w-0 space-y-3">
            <section className="rounded-md border border-primary/25 bg-background p-4 shadow-[0_0_24px_rgba(255,255,255,0.04)]">
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
                {activeSegment && (
                  <span className="shrink-0 rounded border border-border bg-muted px-2 py-1 text-xs text-muted-foreground">
                    #{activeSegment.clip.order}
                  </span>
                )}
              </div>

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

              <div className="mt-4 border-t border-border pt-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Clock3 className="size-3.5 text-primary" />
                  {t('storyboard')}
                </div>
                <p className="text-sm leading-6 text-foreground/90">
                  {activeSegment?.clip.prompt || t('emptyPrompt')}
                </p>
              </div>
            </section>

            <section className="rounded-md border border-border bg-background p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <ScanLine className="size-4 text-primary" />
                {t('shotIndex')}
              </div>
              <div className="grid grid-cols-5 gap-2">
                {segments.map((segment, index) => (
                  <button
                    key={segment.clip.id}
                    type="button"
                    className={cn(
                      'h-9 rounded border text-xs font-medium transition-colors',
                      index === activeIndex
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-muted/20 text-muted-foreground hover:border-primary/45 hover:text-foreground',
                    )}
                    onClick={() => seekToSegment(segment)}
                  >
                    {segment.clip.order}
                  </button>
                ))}
              </div>
            </section>
          </aside>
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
    </div>
  );
}
