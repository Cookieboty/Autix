import type { VideoGenMode } from './VideoToolbar';
import type { FrameSlot, VideoMaterial } from './VideoInputArea';

export const DEFAULT_VIDEO_FRAME_DURATION = 5;

export function inferVideoMaterialType(url: string): VideoMaterial['type'] {
  const lower = url.split('?')[0].toLowerCase();
  if (/\.(mp4|mov|webm|avi|mkv|flv|m4v)$/.test(lower)) return 'video';
  if (/\.(mp3|wav|ogg|aac|flac|m4a)$/.test(lower)) return 'audio';
  return 'image';
}

export function createVideoTemplateMaterials(refs: string[]): VideoMaterial[] {
  const baseId = Date.now();
  return refs.map((url, index) => ({
    id: `tpl-mat-${baseId}-${index}`,
    url,
    name: `template-${index + 1}`,
    type: inferVideoMaterialType(url),
  }));
}

export function createVideoMaterialFromFile(
  file: File,
  url: string,
  options?: { allowAudio?: boolean; idSuffix?: string },
): VideoMaterial {
  const allowAudio = options?.allowAudio ?? true;
  const type = file.type.startsWith('video/')
    ? 'video'
    : allowAudio && file.type.startsWith('audio/')
      ? 'audio'
      : 'image';
  return {
    id: `mat-${Date.now()}${options?.idSuffix ?? ''}`,
    url,
    name: file.name,
    type,
  };
}

export function isImageMaterial(
  material: VideoMaterial | null | undefined,
): material is VideoMaterial {
  return material?.type === 'image';
}

export function createVideoFramesFromImages(
  materials: VideoMaterial[],
  mode: Exclude<VideoGenMode, 'reference'>,
  duration = DEFAULT_VIDEO_FRAME_DURATION,
): FrameSlot[] {
  const baseId = Date.now();
  const imageMaterials = materials.filter(isImageMaterial);
  const frames: FrameSlot[] = imageMaterials
    .slice(0, mode === 'first_last_frame' ? 2 : undefined)
    .map((material, index) => ({
      id: `frame-${baseId}-${index}`,
      material,
      duration,
    }));

  if (mode === 'first_last_frame') {
    while (frames.length < 2) {
      frames.push({ id: `frame-${baseId}-${frames.length}`, material: null, duration });
    }
  } else if (frames.length === 0) {
    frames.push({ id: `frame-${baseId}-0`, material: null, duration });
  }

  return frames;
}

export function createEmptyVideoFrame(
  id = `frame-${Date.now()}`,
  duration = DEFAULT_VIDEO_FRAME_DURATION,
): FrameSlot {
  return { id, material: null, duration };
}

export function swapFirstLastVideoFrames(frames: FrameSlot[]): FrameSlot[] {
  const next = frames.slice(0, Math.max(frames.length, 2));
  while (next.length < 2) {
    next.push(createEmptyVideoFrame(`frame-${Date.now()}-${next.length}`));
  }
  const firstMaterial = next[0]?.material ?? null;
  const lastMaterial = next[1]?.material ?? null;
  return [
    { ...next[0], material: lastMaterial },
    { ...next[1], material: firstMaterial },
    ...frames.slice(2),
  ];
}

export function placeVideoMaterialInFrames(
  frames: FrameSlot[],
  material: VideoMaterial,
  mode: Exclude<VideoGenMode, 'reference'>,
  options?: {
    appendWhenFull?: boolean;
    frameIdSuffix?: string;
    duration?: number;
  },
): FrameSlot[] {
  const firstEmpty = frames.findIndex((frame) => !frame.material);
  if (firstEmpty >= 0) {
    return frames.map((frame, index) =>
      index === firstEmpty ? { ...frame, material } : frame,
    );
  }

  if (mode === 'first_last_frame' && !options?.appendWhenFull) {
    return frames.map((frame, index) =>
      index === 0 ? { ...frame, material } : frame,
    );
  }

  return [
    ...frames,
    {
      id: `frame-${Date.now()}${options?.frameIdSuffix ?? ''}`,
      material,
      duration: options?.duration ?? DEFAULT_VIDEO_FRAME_DURATION,
    },
  ];
}
