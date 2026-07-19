'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Pause, Play } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogTitle } from '../../../ui/dialog';
import { buildPeaks, decodeAudioFile, formatClock, getAudioContext, trimAudioToWav } from './audio-trim';

/**
 * 波形按「每秒固定几根条」铺开，宽度用像素算死。
 * 之前用百分比宽度会和外层 grid item 的 min-width:auto 形成正反馈——
 * 内容撑宽容器、容器又让百分比算出更大宽度，最终整条轨道冲出弹框。
 */
const BAR_WIDTH = 2;
const BAR_GAP = 1;
const BARS_PER_SECOND = 2.5;
const MIN_BARS = 40;
const MAX_BARS = 3000;
/** 选区最短时长（秒），防止拖成 0 宽 */
const MIN_SEGMENT = 1;

/**
 * 音频超长时的裁剪弹框：拖动固定宽度的选区决定用哪一段。
 *
 * 选区可整体平移，也可拖左右边界缩放，但长度上限为 maxSeconds。
 * 交互简单到不需要引 wavesurfer 那类库（它也不负责裁剪与编码）。
 */
export function AudioTrimDialog({
  file,
  maxSeconds,
  onCancel,
  onConfirm,
}: {
  /** 待裁剪的音频文件；为 null 时不渲染 */
  file: File | null;
  maxSeconds: number;
  onCancel: () => void;
  onConfirm: (trimmed: File) => void;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [start, setStart] = useState(0);
  /** 选区长度，可拉伸，上限 maxSeconds */
  const [length, setLength] = useState(maxSeconds);
  const [playing, setPlaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [decodeFailed, setDecodeFailed] = useState(false);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  /** 当前拖动模式；null = 没在拖 */
  const dragModeRef = useRef<'move' | 'start' | 'end' | null>(null);

  const duration = buffer?.duration ?? 0;
  const windowRatio = duration > 0 ? Math.min(1, length / duration) : 1;
  /** 波形内容总宽（px）：条数 × 单条占位。选区位置也按它换算，全程像素对齐 */
  const contentWidth = peaks.length * (BAR_WIDTH + BAR_GAP);

  // 解码：文件换了就重来
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setBuffer(null);
    setPeaks([]);
    setStart(0);
    setDecodeFailed(false);
    decodeAudioFile(file)
      .then((decoded) => {
        if (cancelled) return;
        setBuffer(decoded);
        // 条数随时长增长，保证每秒的横向密度恒定（否则长音频会被压成糊状）
        const bars = Math.min(
          MAX_BARS,
          Math.max(MIN_BARS, Math.round(decoded.duration * BARS_PER_SECOND)),
        );
        setPeaks(buildPeaks(decoded, bars));
        // 音频可能短于上限，选区初始长度取两者较小值
        setLength(Math.min(maxSeconds, decoded.duration));
      })
      .catch(() => {
        if (!cancelled) setDecodeFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  const stopPlayback = useCallback(() => {
    sourceRef.current?.stop();
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    setPlaying(false);
  }, []);

  // 卸载时必须停掉，否则弹框关了声音还在响
  useEffect(() => () => stopPlayback(), [stopPlayback]);

  const togglePlay = useCallback(() => {
    if (!buffer) return;
    if (playing) {
      stopPlayback();
      return;
    }
    // 必须复用单例：每次播放 new 一个且从不 close，Chrome 每文档约 6 个上限，
    // 播放/暂停切换 6 次后第 7 次直接抛 NotSupportedError，播放功能永久失效。
    const context = getAudioContext();
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.onended = () => setPlaying(false);
    source.start(0, start, Math.min(length, duration - start));
    sourceRef.current = source;
    setPlaying(true);
  }, [buffer, duration, length, playing, start, stopPlayback]);

  /**
   * 指针位置 → 时间轴秒数。
   * 用内层内容元素的 rect 而非外层滚动容器 —— 内容比容器宽，
   * 拿容器算会把已滚动出去的部分算错。
   */
  const timeAt = useCallback(
    (clientX: number) => {
      const content = contentRef.current;
      if (!content || duration <= 0) return 0;
      const rect = content.getBoundingClientRect();
      const ratio = (clientX - rect.left) / rect.width;
      return Math.max(0, Math.min(duration, ratio * duration));
    },
    [duration],
  );

  /**
   * 三种拖动：整体平移、拉左边界、拉右边界。
   * 两个边界都受 [MIN_SEGMENT, maxSeconds] 约束 —— 可以缩短，但绝不会超过上限。
   */
  const applyDrag = useCallback(
    (clientX: number) => {
      const mode = dragModeRef.current;
      if (!mode || duration <= 0) return;
      const t = timeAt(clientX);

      if (mode === 'move') {
        setStart(Math.max(0, Math.min(Math.max(0, duration - length), t - length / 2)));
        return;
      }
      if (mode === 'start') {
        const end = start + length;
        // 下界：既不能越过 end-MIN，也不能让选区超过 maxSeconds
        const nextStart = Math.max(Math.max(0, end - maxSeconds), Math.min(t, end - MIN_SEGMENT));
        setStart(nextStart);
        setLength(end - nextStart);
        return;
      }
      // mode === 'end'
      const nextEnd = Math.min(
        Math.min(duration, start + maxSeconds),
        Math.max(t, start + MIN_SEGMENT),
      );
      setLength(nextEnd - start);
    },
    [duration, length, maxSeconds, start, timeAt],
  );

  // 拖动监听挂在 window 上：指针移出轨道甚至移出窗口也能继续拖
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!dragModeRef.current) return;
      applyDrag(event.clientX);
      // 拖到可视边缘时自动横向滚动，否则长音频拖到头就走不动了
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const edge = 48;
      if (event.clientX > rect.right - edge) track.scrollLeft += 12;
      else if (event.clientX < rect.left + edge) track.scrollLeft -= 12;
    };
    const onUp = () => {
      dragModeRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [applyDrag]);

  const handleSave = async () => {
    if (!buffer || !file) return;
    setSaving(true);
    try {
      stopPlayback();
      const trimmed = await trimAudioToWav(buffer, start, length, file.name);
      onConfirm(trimmed);
    } finally {
      setSaving(false);
    }
  };

  const loading = Boolean(file) && !buffer && !decodeFailed;

  return (
    <Dialog
      open={Boolean(file)}
      onOpenChange={(next) => {
        if (!next) {
          stopPlayback();
          onCancel();
        }
      }}
    >
      {/* sm:max-w-none：DialogContent 默认带 sm:max-w-lg(512px)，不覆盖的话宽度会被它压回去 */}
      <DialogContent className="w-[min(550px,92vw)] gap-0 rounded-[18px] border-white/10 bg-[rgb(24,26,28)] p-6 sm:max-w-none">
        <DialogTitle className="text-lg font-bold text-foreground">{t('trimAudioTitle')}</DialogTitle>
        <p className="mt-1 text-sm text-foreground/45">{t('trimAudioHint', { seconds: maxSeconds })}</p>

        {/* min-w-0：DialogContent 是 grid，grid item 默认 min-width:auto，
            不显式归零的话这一行会被内容撑破、整条轨道冲出弹框 */}
        <div className="mt-5 flex min-w-0 items-center gap-3 rounded-[14px] bg-white/[0.04] p-3">
          <button
            type="button"
            onClick={togglePlay}
            disabled={!buffer}
            aria-label={playing ? t('trimAudioPause') : t('trimAudioPlay')}
            className="grid size-8 shrink-0 cursor-pointer place-items-center text-foreground transition hover:opacity-80 disabled:opacity-40"
          >
            {playing ? <Pause className="size-6 fill-current" /> : <Play className="size-6 fill-current" />}
          </button>

          {/* 波形轨道：外层横向滚动，内层按时长按比例加宽 —— 长音频不至于把 15s 选区压成一条缝 */}
          <div
            ref={trackRef}
            className="growth-dark-scrollbar relative h-14 min-w-0 flex-1 overflow-x-auto overflow-y-hidden rounded-[8px] bg-black/25"
          >
            {loading ? (
              <div className="grid h-full place-items-center">
                <Loader2 className="size-4 animate-spin text-foreground/40" />
              </div>
            ) : decodeFailed ? (
              <div className="grid h-full place-items-center text-xs font-semibold text-destructive">
                {t('trimAudioDecodeFailed')}
              </div>
            ) : (
              <div
                ref={contentRef}
                onPointerDown={(event) => {
                  dragModeRef.current = 'move';
                  applyDrag(event.clientX);
                }}
                className="relative h-full cursor-grab touch-none select-none active:cursor-grabbing"
                style={{ width: contentWidth }}
              >
                <div className="flex h-full items-center" style={{ gap: BAR_GAP }}>
                  {peaks.map((peak, index) => (
                    <span
                      key={index}
                      className="shrink-0 rounded-full bg-foreground/30"
                      style={{ width: BAR_WIDTH, height: `${Math.max(8, peak * 82)}%` }}
                    />
                  ))}
                </div>

                {/* 选区：可整体平移，左右边界可拖拽缩放（上限 maxSeconds） */}
                {duration > 0 ? (
                  <div
                    className="pointer-events-none absolute inset-y-1 border-y-2 border-x-[5px] border-growth-accent"
                    style={{
                      left: (start / duration) * contentWidth,
                      width: windowRatio * contentWidth,
                    }}
                  >
                    {/* 两个边界把手：命中区比可见描边宽，否则 5px 太难点中。
                        stopPropagation 防止把事件冒到内容层被当成整体平移。 */}
                    <span
                      role="separator"
                      aria-label={t('trimAudioHandleStart')}
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        dragModeRef.current = 'start';
                      }}
                      className="pointer-events-auto absolute -left-2 top-0 h-full w-4 cursor-ew-resize"
                    />
                    <span
                      role="separator"
                      aria-label={t('trimAudioHandleEnd')}
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        dragModeRef.current = 'end';
                      }}
                      className="pointer-events-auto absolute -right-2 top-0 h-full w-4 cursor-ew-resize"
                    />
                    <span className="absolute -bottom-0.5 left-0.5 text-[10px] font-black leading-none text-growth-accent">
                      {formatClock(length)}
                    </span>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <span className="shrink-0 text-sm font-semibold text-foreground/70">{formatClock(duration)}</span>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              stopPlayback();
              onCancel();
            }}
            className="inline-flex min-h-9 cursor-pointer items-center rounded-full bg-white/8 px-4 text-sm font-bold text-foreground transition hover:bg-white/14"
          >
            {t('trimAudioCancel')}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!buffer || saving}
            className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full bg-growth-accent px-5 text-sm font-black text-background transition hover:brightness-95 disabled:cursor-wait disabled:opacity-60"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {t('trimAudioSave')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
