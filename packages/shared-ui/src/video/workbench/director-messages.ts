import type { VideoClip } from '@autix/shared-store';
import {
  DEFAULT_VIDEO_PARAMS,
  STORYBOARD_TIMELINE_MAX_CLIP_DURATION,
  STORYBOARD_TIMELINE_MIN_CLIP_DURATION,
  STORYBOARD_TIMELINE_TOTAL_MAX_DURATION,
  clipParams,
} from './constants';
import {
  OPTIMIZED_STORYBOARD_PROMPT_PLACEHOLDER,
  OPTIMIZED_VIDEO_PROMPT_PLACEHOLDER,
  storyboardGenerationTemplate,
  storyboardPromptOptimizationTemplate,
  videoPromptOptimizationTemplate,
} from './prompt-templates';

export function buildStoryboardPromptOptimizationMessage({
  clip,
  title,
  params,
  prompt,
}: {
  clip: Pick<VideoClip, 'order' | 'chainFromPrev'>;
  title: string;
  params: Record<string, unknown>;
  prompt: string;
}) {
  const responseShape = {
    action: 'update_params',
    clipOrder: clip.order,
    title,
    params: {
      ...params,
      storyboardPrompt: OPTIMIZED_STORYBOARD_PROMPT_PLACEHOLDER,
    },
    chainFromPrevious: clip.chainFromPrev,
  };
  return storyboardPromptOptimizationTemplate(responseShape, prompt);
}

export function buildVideoPromptOptimizationMessage({
  clip,
  title,
  params,
  prompt,
}: {
  clip: Pick<VideoClip, 'order' | 'chainFromPrev'>;
  title: string;
  params: Record<string, unknown>;
  prompt: string;
}) {
  const responseShape = {
    action: 'update_prompt',
    clipOrder: clip.order,
    title,
    prompt: OPTIMIZED_VIDEO_PROMPT_PLACEHOLDER,
    params,
    chainFromPrevious: clip.chainFromPrev,
  };
  return videoPromptOptimizationTemplate(clip.order, responseShape, prompt);
}

export function resolveStoryboardToolClipCount(value: number) {
  return new Set([2, 3, 5, 6]).has(value) ? value : 5;
}

export function buildStoryboardGenerationSharedParams({
  globalVideoParams,
  selectedClip,
  storyboardPrompt,
}: {
  globalVideoParams: Record<string, unknown>;
  selectedClip: VideoClip | null;
  storyboardPrompt: string;
}) {
  const currentStoryboardPrompt = storyboardPrompt.trim();
  const sharedParams: Record<string, unknown> = {
    ...DEFAULT_VIDEO_PARAMS,
    ...globalVideoParams,
    ...clipParams(selectedClip),
    generationMode: 'storyboard',
    ...(currentStoryboardPrompt ? { storyboardPrompt } : {}),
  };
  if (!currentStoryboardPrompt) delete sharedParams.storyboardPrompt;
  delete sharedParams.startTime;
  delete sharedParams.endTime;
  delete sharedParams.start;
  delete sharedParams.end;
  delete sharedParams.duration;
  return sharedParams;
}

export function buildStoryboardGenerationMessage({
  prompt,
  targetCount,
  suggestedClipDuration,
  suggestedTotalDuration,
  sharedParams,
}: {
  prompt: string;
  targetCount: number;
  suggestedClipDuration: number;
  suggestedTotalDuration: number;
  sharedParams: Record<string, unknown>;
}) {
  return storyboardGenerationTemplate({
    prompt,
    targetCount,
    minClipDuration: STORYBOARD_TIMELINE_MIN_CLIP_DURATION,
    maxClipDuration: STORYBOARD_TIMELINE_MAX_CLIP_DURATION,
    suggestedClipDuration,
    suggestedTotalDuration,
    maxTotalDuration: STORYBOARD_TIMELINE_TOTAL_MAX_DURATION,
    sharedParams,
  });
}
