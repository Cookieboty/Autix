import {
  IMAGE_MODEL_CAPABILITIES,
  detectImageModelKind,
  resolveImagePricingResolution,
  type ImagePricingResolution,
} from '@autix/domain/image';
import { getVideoResolutionOptionsForModel } from '@autix/domain/video';
import type { ModelConfigItem } from '@autix/shared-store';
import type { BusinessTask } from './task-costs-helpers';

export type ScopeField = 'quality' | 'resolution' | 'modelTier' | 'membershipLevel';
export type PricingScopeOption = { value: string; label: string };
export type PricingScopeModel = Pick<
  ModelConfigItem,
  'name' | 'provider' | 'model' | 'metadata' | 'allowedMembershipLevels'
>;
export type PricingMembershipLevel = { id?: string; name: string; level: number; isActive?: boolean };
export type PricingScopeContext = {
  membershipLevels?: PricingMembershipLevel[];
};

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

function videoResolutionOptionsForModel(model: PricingScopeModel) {
  return getVideoResolutionOptionsForModel(model);
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
    return `video:${resolutions}`;
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

function membershipLevelOptions(levels: PricingMembershipLevel[] | undefined) {
  if (!levels || levels.length === 0) return [];
  return [...levels]
    .filter((level) => level.isActive !== false)
    .sort((a, b) => a.level - b.level)
    .map((level) => ({
      value: String(level.level),
      label: `${level.name} (${level.level})`,
    }));
}

function inheritedMembershipLevelOptions(
  models: PricingScopeModel[] | undefined,
  context: PricingScopeContext | undefined,
) {
  const unrestricted = membershipLevelOptions(context?.membershipLevels);
  if (!models || models.length === 0) return unrestricted;

  const restrictedGroups = models
    .map((model) => model.allowedMembershipLevels ?? [])
    .filter((levels) => levels.length > 0);
  if (restrictedGroups.length === 0) return unrestricted;

  const allowedIds = new Set(
    restrictedGroups[0]
      .map((item) => item.levelId ?? item.level?.id)
      .filter((levelId): levelId is string => Boolean(levelId)),
  );
  for (const group of restrictedGroups.slice(1)) {
    const ids = new Set(
      group
        .map((item) => item.levelId ?? item.level?.id)
        .filter((levelId): levelId is string => Boolean(levelId)),
    );
    for (const id of Array.from(allowedIds)) {
      if (!ids.has(id)) allowedIds.delete(id);
    }
  }

  const activeLevels = context?.membershipLevels ?? [];
  const options = membershipLevelOptions(
    activeLevels.filter((level) => level.id && allowedIds.has(level.id)),
  );
  return options.length > 0 ? options : [];
}

export function scopeOptionsForTask(
  task: BusinessTask | undefined,
  field: ScopeField,
  models?: PricingScopeModel[],
  context?: PricingScopeContext,
): PricingScopeOption[] {
  if (!task) return [];
  if (field === 'membershipLevel') {
    return inheritedMembershipLevelOptions(models, context);
  }
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
