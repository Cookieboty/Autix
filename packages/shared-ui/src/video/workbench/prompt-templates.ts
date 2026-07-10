export const OPTIMIZED_STORYBOARD_PROMPT_PLACEHOLDER = 'Optimized full-video storyboard prompt';
export const OPTIMIZED_VIDEO_PROMPT_PLACEHOLDER = 'Optimized complete video prompt';

export function storyboardPromptOptimizationTemplate(responseShape: unknown, prompt: string): string {
  return [
    'Optimize the full-video prompt for storyboard mode.',
    'Requirements: preserve the original idea and do not rewrite each individual shot prompt. Add unified style, visual texture, camera rhythm, subject constraints, transition continuity, and constraints that are easier for the generation model to follow.',
    'Write only the optimized full-video prompt into params.storyboardPrompt.',
    'Return only <video_action> JSON with no extra explanation.',
    `Response shape: ${JSON.stringify(responseShape)}`,
    `Original full-video prompt: ${prompt}`,
  ].join('\n');
}

export function videoPromptOptimizationTemplate(clipOrder: number, responseShape: unknown, prompt: string): string {
  return [
    `Optimize the prompt for video clip ${clipOrder}.`,
    'Requirements: preserve the original idea and do not change the subject. Add camera movement, action rhythm, lighting, composition, texture, and executable details that are easier for the generation model to follow.',
    'Return only <video_action> JSON with no extra explanation.',
    `Response shape: ${JSON.stringify(responseShape)}`,
    `Original prompt: ${prompt}`,
  ].join('\n');
}

export function storyboardGenerationTemplate({
  prompt,
  targetCount,
  minClipDuration,
  maxClipDuration,
  suggestedClipDuration,
  suggestedTotalDuration,
  maxTotalDuration,
  sharedParams,
}: {
  prompt: string;
  targetCount: number;
  minClipDuration: number;
  maxClipDuration: number;
  suggestedClipDuration: number;
  suggestedTotalDuration: number;
  maxTotalDuration: number;
  sharedParams: Record<string, unknown>;
}): string {
  return [
    `Split the video idea / prompt below into exactly ${targetCount} continuous storyboard clips.`,
    `The storyboard must contain exactly ${targetCount} clips: clipOrder must be consecutive from 1 to ${targetCount}; do not omit, add, or merge clips.`,
    'All clips must be tightly continuous on the timeline with no gaps. Do not output startTime, endTime, start, end, or any time-range fields.',
    'Each clip must include clipOrder, title, prompt, params, and chainFromPrevious. The title is a short summary. The prompt must be a complete executable shot description for video generation, including subject, action, camera movement, lighting, rhythm, and other concrete details.',
    `Choose params.duration for each clip based on its content. It must be an integer from ${minClipDuration} to ${maxClipDuration} seconds. Fast or transition shots may be shorter; narrative or emotional shots may be longer. Do not reuse one fixed duration for every clip.`,
    `The sum of all durations should be close to ${suggestedTotalDuration} seconds (reference per-clip duration is about ${suggestedClipDuration} seconds), and the total duration must be <= ${maxTotalDuration} seconds.`,
    `Every clip params object must inherit the shared params below (resolution, ratio, generateAudio, and similar fields), and should only override duration when needed: ${JSON.stringify(sharedParams)}`,
    'chainFromPrevious must be false for the first clip. For all later clips, prefer true when continuity requires it.',
    'Strictly return <video_action> JSON only. Do not return normal prose, Markdown, or extra explanation.',
    `Video idea / prompt: ${prompt}`,
  ].join('\n');
}
