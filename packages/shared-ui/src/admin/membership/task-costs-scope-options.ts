import {
  IMAGE_MODEL_CAPABILITIES,
  detectImageModelKind,
  resolveImagePricingResolution,
  type ImagePricingResolution,
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

const VIDEO_RESOLUTION_RANK: Record<string, number> = {
  '480p': 1,
  '720p': 2,
  '1080p': 3,
};

const IMAGE_PRICING_RESOLUTION_OPTIONS: PricingScopeOption[] = [
  { value: '512px', label: '512px' },
  { value: '1K', label: '1K' },
  { value: '2K', label: '2K' },
  { value: '4K', label: '4K' },
];

function optionsFromValues(values: string[], sourceOptions: PricingScopeOption[]) {
  const valueSet = new Set(values);
  return sourceOptions.filter((option) => valueSet.has(option.value));
}

function uniqueImagePricingResolutionOptions(values: string[]): PricingScopeOption[] {
  return optionsFromValues(values, IMAGE_PRICING_RESOLUTION_OPTIONS);
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
  return uniqueImagePricingResolutionOptions(
    capability.sizes
      .map((option) => resolveImagePricingResolution(option.value))
      .filter((value): value is ImagePricingResolution => Boolean(value)),
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

  return VIDEO_RESOLUTION_SCOPE_OPTIONS;
}

export function pricingParameterSignature(
  task: BusinessTask | undefined,
  model: PricingScopeModel,
) {
  if (!task) return 'unknown';
  if (task.category === 'image') {
    return `image:${detectImageModelKind(model)}`;
  }
  if (task.category === 'video') {
    const resolutions = videoResolutionOptionsForModel(model).map((option) => option.value).join(',');
    const metadata = modelMetadata(model);
    const family =
      typeof metadata.pricingFamily === 'string'
        ? metadata.pricingFamily
        : typeof metadata.modelFamily === 'string'
          ? metadata.modelFamily
          : `${model.provider ?? ''}:${String(model.model ?? '').split(/[-_:]/)[0]}`;
    return `video:${family}:${resolutions}`;
  }
  return 'model';
}

export function canSharePricingRuleModels(
  task: BusinessTask | undefined,
  models: PricingScopeModel[],
) {
  if (!task || models.length <= 1) return true;
  const signatures = new Set(models.map((model) => pricingParameterSignature(task, model)));
  return signatures.size <= 1;
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
