import {
  IMAGE_MODEL_CAPABILITIES,
  detectImageModelKind,
} from '@autix/domain/image';
import type { ModelConfigItem } from '@autix/shared-store';
import type { BusinessTask } from './task-costs-helpers';

export type ScopeField = 'quality' | 'resolution' | 'modelTier';
export type PricingScopeOption = { value: string; label: string };
export type PricingScopeModel = Pick<ModelConfigItem, 'name' | 'provider' | 'model' | 'metadata'>;

export const MODEL_TIER_SCOPE_OPTIONS: PricingScopeOption[] = [
  { value: 'fast', label: 'fast' },
  { value: 'standard', label: 'standard' },
  { value: 'pro_reasoning', label: 'pro_reasoning' },
];

export const IMAGE_QUALITY_SCOPE_OPTIONS: PricingScopeOption[] = [
  { value: 'auto', label: 'auto' },
  { value: 'low', label: 'low' },
  { value: 'medium', label: 'medium' },
  { value: 'high', label: 'high' },
  { value: 'standard', label: 'standard' },
  { value: 'hd', label: 'hd' },
];

export const VIDEO_RESOLUTION_SCOPE_OPTIONS: PricingScopeOption[] = [
  { value: '480p', label: '480p' },
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p' },
];

const IMAGE_SIZE_RATIO_LABELS: Record<string, string> = {
  '1024x1024': '1:1',
  '1536x1024': '3:2',
  '1024x1536': '2:3',
  '2048x2048': '1:1',
  '2048x1152': '16:9',
  '3840x2160': '16:9',
  '2160x3840': '9:16',
  '1024x768': '4:3',
  '768x1024': '3:4',
  '1024x1280': '4:5',
  '1280x1024': '5:4',
  '1792x1024': '16:9',
  '1024x1792': '9:16',
  '2016x864': '21:9',
};

const VIDEO_RESOLUTION_RANK: Record<string, number> = {
  '480p': 1,
  '720p': 2,
  '1080p': 3,
};

function formatImageSizeLabel(value: string) {
  if (value === 'auto') return 'auto';
  const size = value.replace('x', ' x ');
  const ratio = IMAGE_SIZE_RATIO_LABELS[value];
  return ratio ? `${ratio} - ${size}` : size;
}

function uniqueOptions(values: string[]): PricingScopeOption[] {
  const seen = new Set<string>();
  return values.reduce<PricingScopeOption[]>((options, value) => {
    if (!value || seen.has(value)) return options;
    seen.add(value);
    options.push({ value, label: formatImageSizeLabel(value) });
    return options;
  }, []);
}

function optionsFromValues(values: string[], sourceOptions: PricingScopeOption[]) {
  const valueSet = new Set(values);
  return sourceOptions.filter((option) => valueSet.has(option.value));
}

function commonOptions(optionGroups: PricingScopeOption[][]): PricingScopeOption[] {
  if (optionGroups.length === 0) return [];
  if (optionGroups.some((options) => options.length === 0)) return [];
  const groups = optionGroups;
  const common = new Set(groups[0].map((option) => option.value));
  for (const options of groups.slice(1)) {
    const values = new Set(options.map((option) => option.value));
    for (const value of Array.from(common)) {
      if (!values.has(value)) common.delete(value);
    }
  }
  return groups[0].filter((option) => common.has(option.value));
}

function modelMetadata(model: PricingScopeModel | undefined): Record<string, unknown> {
  return model?.metadata && typeof model.metadata === 'object'
    ? model.metadata as Record<string, unknown>
    : {};
}

function imageCapabilityForModel(model: PricingScopeModel) {
  return IMAGE_MODEL_CAPABILITIES[detectImageModelKind(model)];
}

function imageResolutionOptionsForModel(model: PricingScopeModel) {
  const capability = imageCapabilityForModel(model);
  return uniqueOptions(
    (capability.sizes.length > 0
      ? capability.sizes.map((option) => option.value)
      : [capability.defaults.size]
    ).filter(Boolean),
  );
}

function imageQualityOptionsForModel(model: PricingScopeModel) {
  const capability = imageCapabilityForModel(model);
  if (capability.qualities.length === 0) return [];
  return optionsFromValues(
    capability.qualities.map((option) => option.value),
    IMAGE_QUALITY_SCOPE_OPTIONS,
  );
}

function stringList(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  return [];
}

function normalizeVideoResolutionValue(value: unknown): string | null {
  const text = String(value ?? '').toLowerCase();
  if (text.includes('1080')) return '1080p';
  if (text.includes('720')) return '720p';
  if (text.includes('480')) return '480p';
  return null;
}

function videoResolutionOptionsFromValues(values: unknown[]) {
  const normalized = values
    .map(normalizeVideoResolutionValue)
    .filter((value): value is string => Boolean(value));
  return optionsFromValues(normalized, VIDEO_RESOLUTION_SCOPE_OPTIONS);
}

function videoResolutionOptionsUpTo(maxResolution: unknown) {
  const normalized = normalizeVideoResolutionValue(maxResolution);
  if (!normalized) return [];
  const maxRank = VIDEO_RESOLUTION_RANK[normalized] ?? 0;
  return VIDEO_RESOLUTION_SCOPE_OPTIONS.filter((option) =>
    (VIDEO_RESOLUTION_RANK[option.value] ?? 0) <= maxRank,
  );
}

function videoResolutionOptionsForModel(model: PricingScopeModel) {
  const metadata = modelMetadata(model);
  for (const key of ['pricingResolutions', 'supportedResolutions', 'videoResolutions', 'resolutions', 'resolutionOptions']) {
    const options = videoResolutionOptionsFromValues(stringList(metadata[key]));
    if (options.length > 0) return options;
  }
  const maxOptions = videoResolutionOptionsUpTo(metadata.maxResolution ?? metadata.videoMaxResolution);
  if (maxOptions.length > 0) return maxOptions;

  const modelId = `${model.provider ?? ''} ${model.name ?? ''} ${model.model ?? ''}`.toLowerCase();
  if (modelId.includes('fast') && !modelId.includes('pro')) {
    return optionsFromValues(['720p'], VIDEO_RESOLUTION_SCOPE_OPTIONS);
  }
  return VIDEO_RESOLUTION_SCOPE_OPTIONS;
}

function scopedOptionsFromModels(
  models: PricingScopeModel[] | undefined,
  optionsForModel: (model: PricingScopeModel) => PricingScopeOption[],
) {
  if (!models || models.length === 0) return [];
  return commonOptions(models.map(optionsForModel));
}

export function scopeOptionsForTask(
  task: BusinessTask | undefined,
  field: ScopeField,
  models?: PricingScopeModel[],
): PricingScopeOption[] {
  if (!task) return [];
  if (field === 'modelTier' && task.category === 'chat') return MODEL_TIER_SCOPE_OPTIONS;
  if (field === 'quality' && task.category === 'image') {
    return scopedOptionsFromModels(models, imageQualityOptionsForModel);
  }
  if (field === 'resolution' && task.category === 'image') {
    return scopedOptionsFromModels(models, imageResolutionOptionsForModel);
  }
  if (field === 'resolution' && task.category === 'video') {
    return scopedOptionsFromModels(models, videoResolutionOptionsForModel);
  }
  return [];
}
