'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  AlertTriangle,
  Check,
  Clock3,
  Copy,
  Layers3,
  Loader2,
  ScanLine,
  Share2,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  videoShareActions,
  type VideoProjectShareClip,
  type VideoProjectShareDetail,
} from '@autix/shared-store';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import {
  StoryboardTimeline,
  getStoryboardActiveSegmentIndex,
  getStoryboardTotalDuration,
  type StoryboardTimelineSegment,
} from './StoryboardTimeline';
import { useElementHeight } from './useElementHeight';

function formatSeconds(value: number) {
  return `${Math.max(0, Math.round(value))}s`;
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

function finiteDuration(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function buildSegments(clips: VideoProjectShareClip[], totalDuration: number): StoryboardTimelineSegment<VideoProjectShareClip>[] {
  const sorted = [...clips].sort((a, b) => a.order - b.order);
  const knownTotal = sorted.reduce((sum, clip) => sum + (clip.durationSec ?? 0), 0);
  const fallbackDuration = sorted.length > 0
    ? Math.max(1, Math.round((totalDuration || sorted.length) / sorted.length))
    : 1;
  let cursor = 0;
  return sorted.map((clip) => {
    const duration = finiteDuration(clip.durationSec ?? 0) ||
      (knownTotal > 0 ? 1 : fallbackDuration);
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

function fallbackTimelineDuration(segments: StoryboardTimelineSegment[], fallback: number) {
  return getStoryboardTotalDuration(segments) || finiteDuration(fallback);
}

function clampTime(value: number, duration: number) {
  return Math.min(Math.max(value, 0), Math.max(duration, 0));
}

export function VideoSharePageView({ token }: { token: string }) {
  const t = useTranslations('videoShare');
  const locale = useLocale();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoPanelRef = useRef<HTMLElement | null>(null);
  const [detail, setDetail] = useState<VideoProjectShareDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [timelineTime, setTimelineTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let disposed = false;
    setLoading(true);
    setLoadFailed(false);
    videoShareActions.getSharedProject(token)
      .then((nextDetail) => {
        if (disposed) return;
        setDetail(nextDetail);
      })
      .catch(() => {
        if (disposed) return;
        setLoadFailed(true);
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [token]);

  const segments = useMemo(
    () => buildSegments(detail?.clips ?? [], detail?.totalDurationSec ?? 0),
    [detail],
  );
  const timelineDuration = fallbackTimelineDuration(segments, detail?.totalDurationSec ?? 0);
  const activeIndex = getStoryboardActiveSegmentIndex(segments, timelineTime);
  const activeSegment = segments[activeIndex] ?? segments[0] ?? null;
  const hasStoryboard = segments.length > 1;
  const poster = detail?.thumbnailUrl ?? detail?.lastFrameUrl ?? detail?.coverImage ?? undefined;
  const videoPanelHeight = useElementHeight(videoPanelRef);
  const sidePanelStyle = videoPanelHeight
    ? ({ height: videoPanelHeight, maxHeight: videoPanelHeight } as CSSProperties)
    : undefined;

  const videoTimeToTimelineTime = useCallback((time: number, mediaDuration = videoDuration) => {
    const safeMediaDuration = finiteDuration(mediaDuration);
    if (safeMediaDuration > 0 && timelineDuration > 0) {
      return clampTime((time / safeMediaDuration) * timelineDuration, timelineDuration);
    }
    return clampTime(time, timelineDuration);
  }, [timelineDuration, videoDuration]);

  const timelineTimeToVideoTime = useCallback((time: number) => {
    const nextTime = clampTime(time, timelineDuration);
    if (videoDuration > 0 && timelineDuration > 0) {
      return clampTime((nextTime / timelineDuration) * videoDuration, videoDuration);
    }
    return nextTime;
  }, [timelineDuration, videoDuration]);

  const seekToTimelineTime = useCallback((time: number) => {
    const video = videoRef.current;
    const nextTimelineTime = clampTime(time, timelineDuration);
    if (video) video.currentTime = timelineTimeToVideoTime(nextTimelineTime);
    setTimelineTime(nextTimelineTime);
  }, [timelineDuration, timelineTimeToVideoTime]);

  const copyCurrentLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success(t('copied'));
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error(t('copyFailed'));
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-black text-white">
        <div className="flex items-center gap-3 text-sm text-white/70">
          <Loader2 className="size-5 animate-spin" />
          {t('loading')}
        </div>
      </main>
    );
  }

  if (loadFailed || !detail) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-black px-4 text-white">
        <section className="w-full max-w-md rounded-md border border-white/12 bg-white/[0.04] p-6 text-center">
          <AlertTriangle className="mx-auto mb-3 size-8 text-destructive" />
          <h1 className="text-base font-semibold">{t('unavailableTitle')}</h1>
          <p className="mt-2 text-sm leading-6 text-white/60">{t('loadFailed')}</p>
          <Button asChild className="mt-5">
            <a href="/workbench/video">{t('goCreate')}</a>
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-svh bg-black text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 lg:px-6">
        <header className="flex min-h-12 items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="min-w-0">
            <div className="mb-1 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/45">
              <Share2 className="size-3.5" />
              {t('eyebrow')}
            </div>
            <h1 className="truncate text-xl font-semibold md:text-2xl">{detail.title}</h1>
            <p className="mt-1 truncate text-xs text-white/45">{formatDate(detail.updatedAt, locale)}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 gap-2 border-white/12 bg-white/[0.04] text-white hover:bg-white/[0.08]"
            onClick={() => void copyCurrentLink()}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? t('copiedButton') : t('copyLink')}
          </Button>
        </header>

        <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section
            ref={videoPanelRef}
            className="min-w-0 overflow-hidden rounded-md border border-white/12 bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-white/45">
              <span className="inline-flex items-center gap-2">
                <ScanLine className="size-3.5" />
                {t('monitor')}
              </span>
              <span>{formatSeconds(timelineTime)} / {formatSeconds(timelineDuration)}</span>
            </div>
            <video
              ref={videoRef}
              src={detail.videoUrl}
              poster={poster}
              controls
              playsInline
              className="aspect-video w-full bg-black object-contain"
              onTimeUpdate={(event) => setTimelineTime(videoTimeToTimelineTime(event.currentTarget.currentTime))}
              onLoadedMetadata={(event) => {
                const mediaDuration = finiteDuration(event.currentTarget.duration);
                setVideoDuration(mediaDuration);
                setTimelineTime(videoTimeToTimelineTime(event.currentTarget.currentTime, mediaDuration));
              }}
              onDurationChange={(event) => setVideoDuration(finiteDuration(event.currentTarget.duration))}
            />
          </section>

          <aside className="min-w-0 self-stretch lg:min-h-0" style={sidePanelStyle}>
            <section className="flex h-full min-h-0 flex-col rounded-md border border-white/12 bg-white/[0.035] p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-white/45">
                  <Layers3 className="size-3.5" />
                  {t('storyboard')}
                </div>
              </div>

              {hasStoryboard && (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-[11px] text-white/45">{t('duration')}</div>
                    <div className="mt-1 font-semibold">{formatSeconds(timelineDuration)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-white/45">{t('model')}</div>
                    <div className="mt-1 truncate font-semibold">{detail.model}</div>
                  </div>
                </div>
              )}

              <div className={hasStoryboard
                ? 'mt-4 flex min-h-0 flex-1 flex-col border-t border-white/10 pt-4'
                : 'flex min-h-0 flex-1 flex-col'}
              >
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-white/55">
                  <Clock3 className="size-3.5" />
                  {activeSegment ? activeSegment.clip.title || t('clipTitle', { order: activeSegment.clip.order }) : t('clipFallback')}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                  <p className="text-sm leading-6 text-white/78">
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
            currentTime={timelineTime}
            duration={timelineDuration}
            activeIndex={activeIndex}
            title={t('timeline')}
            activeLabel={activeSegment ? activeSegment.clip.title || t('clipTitle', { order: activeSegment.clip.order }) : undefined}
            durationLabel={formatSeconds(timelineDuration)}
            formatTime={formatSeconds}
            getSegmentTitle={(segment) => segment.clip.title || t('clipTitle', { order: segment.clip.order })}
            emptyLabel={t('emptyPrompt')}
            onSeek={seekToTimelineTime}
            variant="dark"
          />
        )}

        <footer className="flex items-center justify-between gap-3 border-t border-white/10 pt-4 text-xs text-white/38">
          <span>Amux Studio</span>
          <span>{t('footer')}</span>
        </footer>
      </div>
    </main>
  );
}
