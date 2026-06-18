import {
  type GenerationPricingEstimate,
  type GenerationPricingEstimateInput,
  type MaterialAsset,
  type MaterialAssetType,
  type ModelConfigItem,
  type VideoTemplate,
  type VideoWorkflowTemplate,
  videoProjectApi,
  videoTemplateApi,
} from '@autix/shared-lib';
import { createLocalVideoProject, type VideoClip } from '@autix/shared-store';

export type VideoWorkspaceMode = 'storyboard' | 'first_last_frame' | 'standard';
export type VideoInspirationTab = 'templates' | 'history' | 'materials';
export type VideoMaterialTarget =
  | 'first_frame'
  | 'last_frame'
  | 'reference_image'
  | 'reference_video'
  | 'reference_audio';

export const VIDEO_MODE_OPTIONS: Array<{
  value: VideoWorkspaceMode;
  label: string;
  description: string;
}> = [
    {
      value: 'standard',
      label: '普通模式',
      description: '单条提示词直接生成视频',
    },
    {
      value: 'first_last_frame',
      label: '首尾帧',
      description: '用首帧和尾帧约束画面起止',
    },
    {
      value: 'storyboard',
      label: '分镜脚本',
      description: '多镜头脚本、镜头连续和尾帧衔接',
    },
  ];

export const MATERIAL_TARGET_OPTIONS: Array<{
  value: VideoMaterialTarget;
  label: string;
  accepts: MaterialAssetType[];
}> = [
    { value: 'first_frame', label: '首帧', accepts: ['image'] },
    { value: 'last_frame', label: '尾帧', accepts: ['image'] },
    { value: 'reference_image', label: '参考图', accepts: ['image'] },
    { value: 'reference_video', label: '参考视频', accepts: ['video'] },
    { value: 'reference_audio', label: '背景音频', accepts: ['audio'] },
  ];

export const STORYBOARD_PRESETS = [
  { count: 2, label: '2 镜头', description: '起承或前后对比' },
  { count: 3, label: '3 镜头', description: '开场、主体、收束' },
  { count: 5, label: '5 镜头', description: '短视频常用节奏' },
  { count: 6, label: '6 镜头', description: '产品/剧情更完整' },
  { count: 7, label: '7 镜头', description: '节奏更细，转场充足' },
  { count: 8, label: '8 镜头', description: '复杂叙事和多卖点' },
];

export const STORYBOARD_TIMELINE_MIN_CLIP_DURATION = 2;
export const STORYBOARD_TIMELINE_MAX_CLIP_DURATION = 15;
export const STORYBOARD_TIMELINE_TOTAL_MAX_DURATION = 15;

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
  resolution: '1080p',
  generateAudio: true,
  generationMode: 'storyboard',
};

export const RESOLUTION_OPTIONS = [
  { label: '480p', value: '480p' },
  { label: '720p', value: '720p' },
  { label: '1080p', value: '1080p' },
];

export const RATIO_OPTIONS = [
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' },
  { label: '4:3', value: '4:3' },
  { label: '3:4', value: '3:4' },
  { label: '1:1', value: '1:1' },
  { label: '21:9', value: '21:9' },
  { label: '自适应', value: 'adaptive' },
];

export type WorkbenchVideoTemplate =
  | ({ templateKind: 'workflow'; templateKey: string } & VideoWorkflowTemplate)
  | ({ templateKind: 'standard'; templateKey: string } & VideoTemplate);

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
}

export function normalizeVideoResolution(value: unknown): string {
  const resolution = String(value ?? '720p').toLowerCase();
  if (resolution.includes('1080')) return '1080p';
  if (resolution.includes('480')) return '480p';
  return '720p';
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

export function resolveSeedancePricingTaskType(clip: VideoClip, videoModel?: ModelConfigItem | null): string {
  const params = clip.params ?? {};
  const model = String(params.model ?? videoModel?.model ?? videoModel?.name ?? '').toLowerCase();
  const resolution = normalizeVideoResolution(params.resolution);
  if (resolution === '1080p') return 'seedance_1080p';
  if (resolution === '480p') return 'seedance_480p';
  if (model.includes('fast')) return 'seedance_fast_720p';
  return 'seedance_720p';
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
  const taskType = resolveSeedancePricingTaskType(clip, videoModel);
  const resolution = normalizeVideoResolution(params.resolution);
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
    modelName,
    resolution,
    seconds,
    referenceImages,
    hasVideoInput,
    hasAudioInput,
  };
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
  const option = MATERIAL_TARGET_OPTIONS.find((item) => item.value === target);
  return Boolean(option?.accepts.includes(asset.type));
}

export function roleLabel(role: string) {
  if (role === 'first_frame') return '首帧';
  if (role === 'last_frame') return '尾帧';
  if (role === 'reference_image') return '参考图';
  if (role === 'reference_video') return '参考视频';
  if (role === 'reference_audio') return '背景音频';
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

export async function loadWorkbenchVideoTemplates(): Promise<WorkbenchVideoTemplate[]> {
  const [workflowResult, standardResult] = await Promise.allSettled([
    videoProjectApi.listWorkflowTemplates({ pageSize: 50 }),
    videoTemplateApi.list({ sort: 'popular', pageSize: 50 }),
  ]);
  const workflowTemplates =
    workflowResult.status === 'fulfilled'
      ? (workflowResult.value.data.items ?? []).map((tpl) => ({
        ...tpl,
        templateKind: 'workflow' as const,
        templateKey: `workflow:${tpl.id}`,
      }))
      : [];
  const standardTemplates =
    standardResult.status === 'fulfilled'
      ? (standardResult.value.data.items ?? []).map((tpl) => ({
        ...tpl,
        templateKind: 'standard' as const,
        templateKey: `standard:${tpl.id}`,
      }))
      : [];
  return [...workflowTemplates, ...standardTemplates];
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
