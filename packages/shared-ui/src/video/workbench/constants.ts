import {
  type GenerationPricingEstimate,
  type GenerationPricingEstimateInput,
  type VideoTemplate,
  type WorkbenchVideoTemplate,
  createLocalVideoProject,
  type MaterialAsset,
  type MaterialAssetType,
  type ModelConfigItem,
  type VideoClip,
} from '@autix/shared-store';
import {
  DEFAULT_VIDEO_RESOLUTION,
  VIDEO_RESOLUTION_VALUES,
  normalizeVideoResolution as normalizeDomainVideoResolution,
  normalizeVideoResolutionForModel,
} from '@autix/domain/video';

export {
  loadWorkbenchVideoTemplates,
  type WorkbenchVideoTemplate,
} from '@autix/shared-store';

export type VideoWorkspaceMode = 'storyboard' | 'first_last_frame' | 'standard';
export type VideoInspirationTab = 'templates' | 'history' | 'materials';
export type VideoMaterialTarget =
  | 'first_frame'
  | 'last_frame'
  | 'reference_image'
  | 'reference_video'
  | 'reference_audio';

export const VIDEO_MODE_VALUES: VideoWorkspaceMode[] = [
  'standard',
  'first_last_frame',
  'storyboard',
];

export const MATERIAL_TARGET_VALUES: Array<{
  value: VideoMaterialTarget;
  accepts: MaterialAssetType[];
}> = [
  { value: 'first_frame', accepts: ['image'] },
  { value: 'last_frame', accepts: ['image'] },
  { value: 'reference_image', accepts: ['image'] },
  { value: 'reference_video', accepts: ['video'] },
  { value: 'reference_audio', accepts: ['audio'] },
];

export const STORYBOARD_PRESET_COUNTS = [2, 3, 5, 6] as const;
export type StoryboardPresetCount = (typeof STORYBOARD_PRESET_COUNTS)[number];

export const STORYBOARD_TIMELINE_MIN_CLIP_DURATION = 2;
export const STORYBOARD_TIMELINE_MAX_CLIP_DURATION = 15;
export const STORYBOARD_TIMELINE_TOTAL_MAX_DURATION = 15;
const STORYBOARD_PARAMS_LABEL = '\u53c2\u6570\uff1a';

export function extractStoryboardPromptFromDirectorContent(
  content: string | null | undefined,
): string | null {
  const paramsMatch = content?.match(new RegExp(`${STORYBOARD_PARAMS_LABEL}(\\{[^\\n]+\\})`));
  if (!paramsMatch) return null;
  try {
    const params = JSON.parse(paramsMatch[1]) as Record<string, unknown>;
    return typeof params.storyboardPrompt === 'string' && params.storyboardPrompt.trim()
      ? params.storyboardPrompt
      : null;
  } catch {
    return null;
  }
}

export function suggestStoryboardClipDuration(clipCount: number) {
  if (!Number.isFinite(clipCount) || clipCount <= 0) return 3;
  return Math.min(
    STORYBOARD_TIMELINE_MAX_CLIP_DURATION,
    Math.max(STORYBOARD_TIMELINE_MIN_CLIP_DURATION, Math.floor(STORYBOARD_TIMELINE_TOTAL_MAX_DURATION / clipCount)),
  );
}

export function clampStoryboardClipDuration(
  value: unknown,
  min = STORYBOARD_TIMELINE_MIN_CLIP_DURATION,
  max = STORYBOARD_TIMELINE_MAX_CLIP_DURATION,
) {
  const duration = Number(value);
  if (!Number.isFinite(duration)) return min;
  return Math.min(max, Math.max(min, Math.round(duration)));
}

export const DEFAULT_VIDEO_PARAMS = {
  duration: 5,
  ratio: '16:9',
  resolution: DEFAULT_VIDEO_RESOLUTION,
  generateAudio: true,
  generationMode: 'storyboard',
};

export const RESOLUTION_VALUES = VIDEO_RESOLUTION_VALUES;

export const RATIO_VALUES = ['16:9', '9:16', '4:3', '3:4', '1:1', '21:9', 'adaptive'] as const;

export type VideoEstimateTarget =
  | { mode: 'single'; clipId: string }
  | { mode: 'batch'; clipIds: string[] };

export interface VideoClipEstimate {
  clip: VideoClip;
  estimate: GenerationPricingEstimate;
  taskType: string;
  seconds: number;
  resolution: string;
  referenceImages: number;
  hasVideoInput: boolean;
  hasAudioInput: boolean;
  submittedClipCount?: number;
}

export function normalizeVideoResolution(value: unknown): string {
  return normalizeDomainVideoResolution(value);
}

export function normalizeVideoDuration(value: unknown): number {
  const duration = Number(value ?? 5);
  if (!Number.isFinite(duration) || duration <= 0) return 5;
  return Math.ceil(duration);
}

export function resolveClipVideoModel(clip: VideoClip, videoModels: ModelConfigItem[]): ModelConfigItem | null {
  const modelConfigId = String((clip.params ?? {}).modelConfigId ?? '');
  if (!modelConfigId) return null;
  return videoModels.find((model) => model.id === modelConfigId) ?? null;
}

export function resolveVideoPricingTaskType(clip: VideoClip, videoModel?: ModelConfigItem | null): string {
  return 'video_generation';
}

export function buildVideoEstimateInput(
  clip: VideoClip,
  videoModel?: ModelConfigItem | null,
): GenerationPricingEstimateInput & {
  seconds: number;
  resolution: string;
  referenceImages: number;
  hasVideoInput: boolean;
  hasAudioInput: boolean;
} {
  const params = clip.params ?? {};
  const taskType = resolveVideoPricingTaskType(clip, videoModel);
  const resolution = normalizeVideoResolutionForModel(params.resolution, videoModel);
  const seconds = normalizeVideoDuration(params.duration);
  const referenceImages = clip.materials.filter((material) =>
    ['first_frame', 'last_frame', 'reference_image'].includes(material.role),
  ).length;
  const hasVideoInput = clip.materials.some((material) => material.role === 'reference_video');
  const hasAudioInput =
    clip.materials.some((material) => material.role === 'reference_audio') ||
    params.generateAudio === true ||
    params.generate_audio === true;
  const modelName =
    typeof params.model === 'string' && params.model.trim()
      ? params.model
      : videoModel?.model;

  return {
    taskType,
    modelProvider: videoModel?.provider ?? undefined,
    modelName,
    resolution,
    seconds,
    referenceImages,
    hasVideoInput,
    hasAudioInput,
  };
}

export function buildVideoBatchEstimateInput(
  clips: VideoClip[],
  videoModels: ModelConfigItem[],
): (GenerationPricingEstimateInput & {
  seconds: number;
  resolution: string;
  referenceImages: number;
  hasVideoInput: boolean;
  hasAudioInput: boolean;
}) | null {
  const firstClip = clips[0];
  if (!firstClip) return null;

  const firstInput = buildVideoEstimateInput(firstClip, resolveClipVideoModel(firstClip, videoModels));
  return clips.slice(1).reduce((input, clip) => {
    const clipInput = buildVideoEstimateInput(clip, resolveClipVideoModel(clip, videoModels));
    return {
      ...input,
      seconds: input.seconds + clipInput.seconds,
      referenceImages: input.referenceImages + clipInput.referenceImages,
      hasVideoInput: input.hasVideoInput || clipInput.hasVideoInput,
      hasAudioInput: input.hasAudioInput || clipInput.hasAudioInput,
    };
  }, firstInput);
}

export function canGenerateClip(clip: VideoClip): boolean {
  const params = clipParams(clip);
  const storyboardPrompt =
    params.generationMode === 'storyboard' ? clipStoryboardPrompt(clip).trim() : '';
  return Boolean(clip.prompt?.trim() || storyboardPrompt || clip.materials.length > 0);
}

export function isVideoWorkspaceMode(value: unknown): value is VideoWorkspaceMode {
  return value === 'storyboard' || value === 'first_last_frame' || value === 'standard';
}

export function defaultMaterialTargetForType(type: MaterialAssetType): VideoMaterialTarget {
  if (type === 'video') return 'reference_video';
  if (type === 'audio') return 'reference_audio';
  return 'first_frame';
}

export function canUseMaterialAsTarget(asset: MaterialAsset, target: VideoMaterialTarget) {
  const option = MATERIAL_TARGET_VALUES.find((item) => item.value === target);
  return Boolean(option?.accepts.includes(asset.type));
}

export interface MaterialTargetLabelMessages {
  firstFrame: string;
  lastFrame: string;
  referenceImage: string;
  referenceVideo: string;
  referenceAudio: string;
}

export function roleLabel(role: string, messages: MaterialTargetLabelMessages) {
  if (role === 'first_frame') return messages.firstFrame;
  if (role === 'last_frame') return messages.lastFrame;
  if (role === 'reference_image') return messages.referenceImage;
  if (role === 'reference_video') return messages.referenceVideo;
  if (role === 'reference_audio') return messages.referenceAudio;
  return role;
}

export function clipParams(clip: VideoClip | null): Record<string, unknown> {
  return clip?.params && typeof clip.params === 'object' && !Array.isArray(clip.params)
    ? clip.params
    : {};
}

export function clipStoryboardPrompt(clip: VideoClip | null): string {
  const value = clipParams(clip).storyboardPrompt;
  return typeof value === 'string' ? value : '';
}

export function resolveStoryboardPrompt(clips: VideoClip[]): string {
  for (const clip of clips) {
    const prompt = clipStoryboardPrompt(clip).trim();
    if (prompt) return prompt;
  }
  return '';
}

export function resolveLatestCompletedVideoGeneration(
  clip: VideoClip | null,
): VideoClip['generations'][number] | null {
  return (
    clip?.generations
      ?.filter((generation) => generation.status === 'completed' && generation.videoUrl)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ??
    null
  );
}

export function templateMatchesQuery(template: WorkbenchVideoTemplate, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const searchable = [
    template.title,
    template.description,
    template.category,
    ...(template.tags ?? []),
    template.templateKind === 'standard' ? template.prompt : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return (
    searchable.includes(q) ||
    (template.templateKind === 'workflow' &&
      template.clips.some((clip) =>
        [clip.title, clip.promptTemplate].filter(Boolean).join(' ').toLowerCase().includes(q),
      ))
  );
}

export function resolveVideoTemplateVariables(template: VideoTemplate): Record<string, string> {
  const values: Record<string, string> = {};
  for (const variable of template.variables ?? []) {
    if (variable.default == null) continue;
    values[variable.key] = String(variable.default);
  }
  return values;
}

export function resolvePromptVariables(prompt: string, values: Record<string, string>) {
  return prompt.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, key: string) => {
    const value = values[key.trim()];
    return value == null ? match : value;
  });
}

export function buildTemplateDraft(template: WorkbenchVideoTemplate) {
  if (template.templateKind === 'workflow') {
    return createLocalVideoProject(
      template.title,
      template.clips.map((clip) => ({
        title: clip.title,
        prompt: clip.promptTemplate,
        params: { ...DEFAULT_VIDEO_PARAMS, ...(clip.defaultParams ?? {}), generationMode: 'storyboard' },
        chainFromPrev: clip.chainFromPrevious,
      })),
      template.coverImage,
    );
  }

  const variables = resolveVideoTemplateVariables(template);
  const prompt = resolvePromptVariables(template.prompt, variables);
  const defaultParams =
    template.defaultParams && typeof template.defaultParams === 'object' && !Array.isArray(template.defaultParams)
      ? (template.defaultParams as Record<string, unknown>)
      : {};
  const variableDuration = Number(variables.duration);
  const paramsDuration = Number(defaultParams.duration);
  const duration =
    (Number.isFinite(variableDuration) && variableDuration > 0 ? variableDuration : undefined) ??
    (Number.isFinite(paramsDuration) && paramsDuration > 0 ? paramsDuration : undefined) ??
    template.durationSec ??
    5;

  return createLocalVideoProject(
    template.title,
    [
      {
        title: template.title,
        prompt,
        params: {
          ratio: '16:9',
          resolution: '1080p',
          generateAudio: true,
          generationMode: 'standard',
          ...defaultParams,
          duration,
        },
        chainFromPrev: false,
      },
    ],
    template.coverImage,
  );
}
