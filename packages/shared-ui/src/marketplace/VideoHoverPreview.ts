'use client';

import { useCallback, useEffect, useRef } from 'react';

const VIDEO_FILE_RE = /\.(mp4|webm|ogg|mov|m4v)(?:$|[?#])/i;

export interface VideoPreviewResource {
  exampleMedia?: unknown;
  externalMetadata?: Record<string, unknown> | null;
}

function isVideoUrl(value: unknown): boolean {
  return typeof value === 'string' && VIDEO_FILE_RE.test(value.trim());
}

function nestedString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' ? value : null;
}

function hasVideoTypeHint(record: Record<string, unknown>): boolean {
  const type =
    nestedString(record, 'type') ??
    nestedString(record, 'mime') ??
    nestedString(record, 'mimeType') ??
    nestedString(record, 'mediaType') ??
    '';
  return type.toLowerCase().includes('video');
}

function firstVideoUrl(value: unknown): string | null {
  if (typeof value === 'string' && isVideoUrl(value)) return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstVideoUrl(item);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const direct =
      nestedString(record, 'url') ??
      nestedString(record, 'src') ??
      nestedString(record, 'videoUrl') ??
      nestedString(record, 'previewUrl') ??
      nestedString(record, 'previewVideoUrl');
    if (typeof direct === 'string' && isVideoUrl(direct)) return direct.trim();
    if (direct && hasVideoTypeHint(record)) return direct.trim();
    return (
      firstVideoUrl(record.video) ??
      firstVideoUrl(record.preview) ??
      firstVideoUrl(record.media) ??
      firstVideoUrl(record.items)
    );
  }
  return null;
}

export function getVideoPreviewUrl(
  resource: VideoPreviewResource | null | undefined,
): string | null {
  if (!resource) return null;
  const metadata = resource.externalMetadata ?? {};
  return (
    firstVideoUrl(resource.exampleMedia) ??
    firstVideoUrl(metadata.previewVideoUrl) ??
    firstVideoUrl(metadata.previewUrl) ??
    firstVideoUrl(metadata.videoUrl) ??
    firstVideoUrl(metadata.video) ??
    firstVideoUrl(metadata.exampleMedia) ??
    null
  );
}

export function useTimedVideoPreview(
  previewUrl: string | null,
  durationMs = 4200,
) {
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const previewTimerRef = useRef<number | null>(null);

  const clearPreviewTimer = useCallback(() => {
    if (previewTimerRef.current) {
      window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
  }, []);

  const stopPreview = useCallback(() => {
    clearPreviewTimer();
    const video = previewRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = 0;
  }, [clearPreviewTimer]);

  const startPreview = useCallback(() => {
    if (!previewUrl) return;
    clearPreviewTimer();
    const video = previewRef.current;
    if (!video) return;
    video.currentTime = 0;
    void video.play().catch(() => {
      stopPreview();
    });
    previewTimerRef.current = window.setTimeout(stopPreview, durationMs);
  }, [clearPreviewTimer, durationMs, previewUrl, stopPreview]);

  useEffect(() => stopPreview, [stopPreview]);

  return {
    previewRef,
    startPreview,
    stopPreview,
  };
}
