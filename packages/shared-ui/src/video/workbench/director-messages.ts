import type { VideoClip } from '@autix/shared-store';
import {
  DEFAULT_VIDEO_PARAMS,
  STORYBOARD_TIMELINE_MAX_CLIP_DURATION,
  STORYBOARD_TIMELINE_MIN_CLIP_DURATION,
  STORYBOARD_TIMELINE_TOTAL_MAX_DURATION,
  clipParams,
} from './constants';

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
      storyboardPrompt: '优化后的整片视频提示词',
    },
    chainFromPrevious: clip.chainFromPrev,
  };
  return [
    '请优化分镜模式的整片提示词。',
    '要求：保留原始创意，不改每个分镜的单镜头 prompt；补充整片统一风格、视觉质感、镜头节奏、主体限制、转场连续性和生成模型更容易理解的约束。',
    '只把优化后的整片提示词写入 params.storyboardPrompt。',
    '必须只返回 <video_action> JSON，不要输出其他解释。',
    `返回格式：${JSON.stringify(responseShape)}`,
    `原始整片提示词：${prompt}`,
  ].join('\n');
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
    prompt: '优化后的完整视频提示词',
    params,
    chainFromPrevious: clip.chainFromPrev,
  };
  return [
    `请优化第 ${clip.order} 个视频片段的提示词。`,
    '要求：保留原始创意，不改变画面主体；补充镜头运动、动作节奏、光线、构图、质感和生成模型更容易理解的细节。',
    '必须只返回 <video_action> JSON，不要输出其他解释。',
    `返回格式：${JSON.stringify(responseShape)}`,
    `原始提示词：${prompt}`,
  ].join('\n');
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
  return [
    `请根据下面的视频创意 / Prompt，严格拆成 ${targetCount} 个连续分镜脚本。`,
    `分镜数量必须正好等于 ${targetCount}：clipOrder 必须从 1 到 ${targetCount} 连续编号，不能少、不能多、不能合并输出。`,
    '所有分镜在时间轴上必须紧密连续排列，不存在中间空白段；不要输出 startTime、endTime、start、end 等起止时间字段。',
    '每个分镜需要包含 clipOrder、title、prompt、params、chainFromPrevious；title 用作简短摘要，prompt 必须是可直接用于视频生成的完整镜头描述（含画面主体、动作、镜头运动、光线、节奏等可执行细节）。',
    `每个分镜 params.duration 由你根据镜头内容合理决定，必须是 ${STORYBOARD_TIMELINE_MIN_CLIP_DURATION}-${STORYBOARD_TIMELINE_MAX_CLIP_DURATION} 秒的整数：节奏快或转场镜头可偏短，叙事或情绪镜头可偏长；不要给所有分镜复用同一个固定时长。`,
    `所有分镜 duration 加总尽量贴近 ${suggestedTotalDuration} 秒（参考单镜 ≈ ${suggestedClipDuration} 秒），且总时长必须 ≤ ${STORYBOARD_TIMELINE_TOTAL_MAX_DURATION} 秒。`,
    `每个分镜 params 必须继承下面的共享参数（resolution、ratio、generateAudio 等），仅按需覆盖 duration：${JSON.stringify(sharedParams)}`,
    'chainFromPrevious：第 1 个分镜为 false，其余分镜根据连续镜头需要优先设为 true。',
    '必须严格返回 <video_action> JSON，不要返回普通说明、Markdown 或额外解释。',
    `视频创意 / Prompt：${prompt}`,
  ].join('\n');
}
