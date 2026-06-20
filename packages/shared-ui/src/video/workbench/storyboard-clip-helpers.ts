import type { VideoClip } from '@autix/shared-store';
import {
  DEFAULT_VIDEO_PARAMS,
  STORYBOARD_TIMELINE_MAX_CLIP_DURATION,
  STORYBOARD_TIMELINE_TOTAL_MAX_DURATION,
  clampStoryboardClipDuration,
  clipParams,
  suggestStoryboardClipDuration,
} from './constants';

export function resolveNextStoryboardClipDuration(
  clips: VideoClip[],
  requestedDuration: number,
) {
  const fallbackDuration = suggestStoryboardClipDuration(clips.length || 1);
  const currentTotalDuration = clips.reduce(
    (total, clip) => total + clampStoryboardClipDuration(clipParams(clip).duration ?? fallbackDuration),
    0,
  );
  const remainingDuration = Math.max(0, STORYBOARD_TIMELINE_TOTAL_MAX_DURATION - currentTotalDuration);

  return Math.min(
    STORYBOARD_TIMELINE_MAX_CLIP_DURATION,
    remainingDuration,
    Number.isFinite(requestedDuration) ? requestedDuration : STORYBOARD_TIMELINE_MAX_CLIP_DURATION,
  );
}

export function buildStoryboardClipParams({
  duration,
  globalVideoParams,
  storyboardPrompt,
}: {
  duration: number;
  globalVideoParams: Record<string, unknown>;
  storyboardPrompt: string;
}) {
  const trimmedStoryboardPrompt = storyboardPrompt.trim();
  const params: Record<string, unknown> = {
    ...DEFAULT_VIDEO_PARAMS,
    ...globalVideoParams,
    generationMode: 'storyboard',
    duration,
    ...(trimmedStoryboardPrompt ? { storyboardPrompt } : {}),
  };
  delete params.startTime;
  delete params.endTime;
  delete params.start;
  delete params.end;
  return params;
}
