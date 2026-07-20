'use client';

import { useMemo } from 'react';

/**
 * 列表里音频卡片的波形示意。
 *
 * **这是由 id 派生的确定性伪波形，不是真实音频数据。** 真实波形要 decodeAudioData
 * 解完整段 PCM，一屏几十个音频全解会明显卡顿、还要占大量内存；而这里只是让用户
 * 一眼认出"这是个音频"。裁剪弹框里用的是真实波形（那里只解一个文件）。
 *
 * 用 id 做种子而不是随机数：同一个素材每次渲染形状一致，列表滚动或重渲染不会跳变。
 */
function pseudoPeaks(seed: string, count: number): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const peaks: number[] = [];
  for (let i = 0; i < count; i += 1) {
    // 线性同余，取高位做值：低位周期短，直接用会出现明显重复的锯齿
    hash = (hash * 1664525 + 1013904223) >>> 0;
    peaks.push(0.22 + ((hash >>> 16) % 1000) / 1000 * 0.78);
  }
  return peaks;
}

export function AudioWaveThumb({
  seed,
  bars = 28,
  className,
}: {
  seed: string;
  bars?: number;
  className?: string;
}) {
  const peaks = useMemo(() => pseudoPeaks(seed, bars), [seed, bars]);
  return (
    <span
      aria-hidden
      className={`flex h-full w-full items-center justify-center gap-[2px] ${className ?? ''}`}
    >
      {peaks.map((peak, index) => (
        <span
          key={index}
          className="w-[2px] shrink-0 rounded-full bg-foreground/45"
          style={{ height: `${Math.round(peak * 100)}%` }}
        />
      ))}
    </span>
  );
}
