'use client';

import { useRef, useState } from 'react';
import { Play, Pause, Maximize, Download } from 'lucide-react';

interface VideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
}

export function VideoPlayer({ src, poster, className }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    setProgress((video.currentTime / video.duration) * 100);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    video.currentTime = ratio * video.duration;
  };

  const handleFullscreen = () => {
    videoRef.current?.requestFullscreen?.();
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = src;
    a.download = '';
    a.click();
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`relative group ${className ?? ''}`}>
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="w-full rounded-lg"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
        onEnded={() => setPlaying(false)}
        onClick={togglePlay}
      />

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 rounded-b-lg bg-gradient-to-t from-black/60 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
        <div className="h-1 w-full cursor-pointer rounded bg-white/30" onClick={handleSeek}>
          <div className="h-full rounded bg-white transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <button type="button" onClick={togglePlay} className="hover:text-white/80">
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </button>
            <span className="text-xs">
              {formatTime((progress / 100) * duration)} / {formatTime(duration)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleDownload} className="hover:text-white/80">
              <Download className="size-4" />
            </button>
            <button type="button" onClick={handleFullscreen} className="hover:text-white/80">
              <Maximize className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
