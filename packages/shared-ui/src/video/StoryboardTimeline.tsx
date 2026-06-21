'use client';

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ScanLine } from 'lucide-react';
import { cn } from '../ui/utils';

export interface StoryboardTimelineSegment<TClip = unknown> {
  id: string;
  order: number;
  title?: string | null;
  start: number;
  end: number;
  duration: number;
  clip: TClip;
}

interface StoryboardTimelineProps<TClip> {
  segments: StoryboardTimelineSegment<TClip>[];
  currentTime: number;
  duration: number;
  activeIndex: number;
  title: string;
  durationLabel: string;
  formatTime: (value: number) => string;
  getSegmentTitle: (segment: StoryboardTimelineSegment<TClip>) => string;
  onSeek: (time: number) => void;
  activeLabel?: string;
  emptyLabel?: string;
  variant?: 'light' | 'dark';
  className?: string;
}

export function getStoryboardTotalDuration(segments: StoryboardTimelineSegment[]) {
  return Math.ceil(segments.reduce((sum, segment) => sum + segment.duration, 0));
}

export function getStoryboardActiveSegmentIndex(segments: StoryboardTimelineSegment[], currentTime: number) {
  if (segments.length === 0) return -1;
  const hit = segments.findIndex((segment) => currentTime >= segment.start && currentTime < segment.end);
  return hit >= 0 ? hit : segments.length - 1;
}

function clampTime(value: number, duration: number) {
  return Math.min(Math.max(value, 0), Math.max(duration, 0));
}

function progressPercent(currentTime: number, duration: number) {
  if (!Number.isFinite(currentTime) || duration <= 0) return 0;
  return Math.min(100, Math.max(0, (currentTime / duration) * 100));
}

export function StoryboardTimeline<TClip>({
  segments,
  currentTime,
  duration,
  activeIndex,
  title,
  durationLabel,
  formatTime,
  getSegmentTitle,
  onSeek,
  activeLabel,
  emptyLabel,
  variant = 'light',
  className,
}: StoryboardTimelineProps<TClip>) {
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const scrubStartXRef = useRef(0);
  const didDragTimelineRef = useRef(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const isDark = variant === 'dark';
  const safeCurrentTime = clampTime(currentTime, duration);
  const timelineProgress = progressPercent(safeCurrentTime, duration);

  const seekFromPointer = useCallback((clientX: number) => {
    const track = timelineRef.current;
    if (!track || duration <= 0) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    onSeek(duration * ratio);
  }, [duration, onSeek]);

  const endScrubbing = (event: ReactPointerEvent<HTMLDivElement>) => {
    setIsScrubbing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    window.setTimeout(() => {
      didDragTimelineRef.current = false;
    }, 0);
  };

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-md p-2 shadow-[0_0_24px_rgba(255,255,255,0.04)]',
        isDark ? 'border border-white/12 bg-white/[0.025]' : 'border border-primary/20 bg-background',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(to_right,rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.05)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="relative mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div
            className={cn(
              'inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em]',
              isDark ? 'text-white/55' : 'text-primary',
            )}
          >
            <ScanLine className="size-3.5" />
            {title}
          </div>
          {activeLabel && (
            <p className={cn('mt-1 truncate text-xs', isDark ? 'text-white/45' : 'text-muted-foreground')}>
              {activeLabel}
            </p>
          )}
        </div>
        <span
          className={cn(
            'shrink-0 rounded border px-2 py-1 text-[11px]',
            isDark
              ? 'border-white/12 bg-white/[0.04] text-white/55'
              : 'border-primary/25 bg-primary/10 text-primary',
          )}
        >
          {durationLabel}
        </span>
      </div>

      <div
        ref={timelineRef}
        role="slider"
        tabIndex={0}
        aria-label={title}
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={Math.round(safeCurrentTime)}
        aria-valuetext={formatTime(safeCurrentTime)}
        className={cn(
          'relative cursor-ew-resize rounded-md bg-black/45 p-2 outline-none ring-primary/40 focus-visible:ring-2',
          isDark ? 'border border-white/12' : 'border border-border',
          isScrubbing && (isDark ? 'border-white/45' : 'border-primary/50'),
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
            onSeek(safeCurrentTime - 1);
          }
          if (event.key === 'ArrowRight') {
            event.preventDefault();
            onSeek(safeCurrentTime + 1);
          }
        }}
      >
        <div className="relative h-10">
          <div
            className={cn(
              'pointer-events-none absolute top-0 -bottom-2 z-20 w-px shadow-[0_0_16px_rgba(255,255,255,0.55)]',
              isDark ? 'bg-white' : 'bg-primary',
            )}
            style={{ left: `${timelineProgress}%` }}
          >
            <span
              className={cn(
                'absolute -bottom-2 -left-2 size-4 rotate-45 shadow-[0_0_12px_rgba(255,255,255,0.45)]',
                isDark ? 'border border-white bg-black' : 'border border-primary bg-background',
              )}
            />
          </div>

          {segments.length > 0 ? (
            <div className="flex h-full gap-1">
              {segments.map((segment, index) => {
                const segmentTitle = getSegmentTitle(segment);
                return (
                  <button
                    key={segment.id}
                    type="button"
                    className={cn(
                      'group relative min-w-14 overflow-hidden rounded-sm border px-2 py-1.5 text-left transition-all',
                      isDark
                        ? index === activeIndex
                          ? 'border-white bg-white/[0.18] shadow-[0_0_18px_rgba(255,255,255,0.18)]'
                          : index < activeIndex
                            ? 'border-white/35 bg-white/[0.11]'
                            : 'border-white/10 bg-white/[0.055] hover:border-white/35 hover:bg-white/[0.09]'
                        : index === activeIndex
                          ? 'border-primary bg-primary/25 shadow-[0_0_18px_rgba(255,255,255,0.16)]'
                          : index < activeIndex
                            ? 'border-primary/35 bg-primary/[0.12]'
                            : 'border-white/10 bg-white/[0.06] hover:border-primary/40 hover:bg-white/[0.09]',
                    )}
                    style={{ flexGrow: Math.max(segment.duration, 1), flexBasis: 0 }}
                    onClick={() => {
                      if (didDragTimelineRef.current) return;
                      onSeek(segment.start);
                    }}
                    aria-label={segmentTitle}
                  >
                    <span className="absolute inset-x-0 top-0 h-px bg-white/20" />
                    <span
                      className={cn(
                        'absolute inset-x-1 top-1 flex justify-between text-[10px]',
                        isDark ? 'text-white/45' : 'text-muted-foreground',
                      )}
                    >
                      <span>#{segment.order}</span>
                      <span>{formatTime(segment.duration)}</span>
                    </span>
                    <span
                      className={cn(
                        'absolute inset-x-2 bottom-1.5 truncate text-[11px] font-medium',
                        isDark ? 'text-white/82' : 'text-foreground/85',
                      )}
                    >
                      {segmentTitle}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div
              className={cn(
                'flex h-full items-center justify-center rounded-sm border border-dashed text-xs',
                isDark ? 'border-white/12 text-white/45' : 'border-border text-muted-foreground',
              )}
            >
              {emptyLabel}
            </div>
          )}
        </div>

        <div
          className={cn(
            'relative mt-2 flex h-5 items-start justify-between border-t border-white/10 pt-1 text-[10px]',
            isDark ? 'text-white/45' : 'text-muted-foreground',
          )}
        >
          {Array.from({ length: 6 }, (_, index) => {
            const tick = Math.round((duration * index) / 5);
            return (
              <span key={index} className="relative flex min-w-0 flex-col items-center gap-1">
                <span className="h-2 w-px bg-white/25" />
                <span>{formatTime(tick)}</span>
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
