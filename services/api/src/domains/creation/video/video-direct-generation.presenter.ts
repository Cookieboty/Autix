import type { video_clip_generations } from '../../platform/prisma/generated';

export interface DirectVideoGenerationDto {
  id: string;
  status: string;
  prompt: string;
  model: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  lastFrameUrl: string | null;
  durationSec: number | null;
  error: string | null;
  options: Record<string, unknown>;
  materials: Array<{ role: string; url: string; sourceType?: string; name?: string | null }>;
  createdAt: string;
}

export function toDirectVideoGenerationDto(g: video_clip_generations): DirectVideoGenerationDto {
  const snap = (g.params && typeof g.params === 'object' && !Array.isArray(g.params)) ? g.params as Record<string, unknown> : {};
  return {
    id: g.id,
    status: g.status,
    prompt: g.resolvedPrompt,
    model: g.model,
    videoUrl: g.videoUrl,
    thumbnailUrl: g.thumbnailUrl,
    lastFrameUrl: g.lastFrameUrl,
    durationSec: g.durationSec,
    error: g.error,
    options: (snap.options as Record<string, unknown>) ?? {},
    materials: Array.isArray(snap.materials) ? snap.materials as DirectVideoGenerationDto['materials'] : [],
    createdAt: g.createdAt.toISOString(),
  };
}
