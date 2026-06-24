export type PricingTaskCategory = 'chat' | 'image' | 'video' | 'prompt';

export type PricingConditionField =
  | 'modelKey'
  | 'modelTier'
  | 'quality'
  | 'resolution'
  | 'seconds'
  | 'referenceImages'
  | 'hasVideoInput'
  | 'hasAudioInput'
  | 'priority'
  | 'membershipLevel';

export type PricingDimensionControl =
  | 'model-multi'
  | 'enum-multi'
  | 'number-range'
  | 'number'
  | 'boolean'
  | 'token-number';

export interface PricingDimensionDefinition {
  field: PricingConditionField;
  labelKey: string;
  categories: PricingTaskCategory[];
  control: PricingDimensionControl;
  condition?: boolean;
  preview?: boolean;
  defaultPreviewValue?: unknown;
}

export const PRICING_DIMENSIONS: PricingDimensionDefinition[] = [
  {
    field: 'modelKey',
    labelKey: 'labels.systemModel',
    categories: ['chat', 'image', 'video', 'prompt'],
    control: 'model-multi',
    condition: true,
    preview: true,
  },
  {
    field: 'modelTier',
    labelKey: 'labels.modelTier',
    categories: ['chat'],
    control: 'enum-multi',
    condition: true,
    preview: true,
  },
  {
    field: 'quality',
    labelKey: 'labels.quality',
    categories: ['image'],
    control: 'enum-multi',
    condition: true,
    preview: true,
  },
  {
    field: 'resolution',
    labelKey: 'labels.resolution',
    categories: ['image', 'video'],
    control: 'enum-multi',
    condition: true,
    preview: true,
  },
  {
    field: 'seconds',
    labelKey: 'labels.durationSeconds',
    categories: ['video'],
    control: 'number-range',
    condition: true,
    preview: true,
    defaultPreviewValue: 5,
  },
  {
    field: 'referenceImages',
    labelKey: 'preview.referenceImages',
    categories: ['image', 'video'],
    control: 'number',
    preview: true,
    defaultPreviewValue: 0,
  },
  {
    field: 'hasVideoInput',
    labelKey: 'preview.hasVideoInput',
    categories: ['video'],
    control: 'boolean',
    condition: true,
    preview: true,
    defaultPreviewValue: false,
  },
  {
    field: 'hasAudioInput',
    labelKey: 'preview.hasAudioInput',
    categories: ['video'],
    control: 'boolean',
    condition: true,
    preview: true,
    defaultPreviewValue: false,
  },
  {
    field: 'priority',
    labelKey: 'preview.priority',
    categories: ['video'],
    control: 'boolean',
    condition: true,
    preview: true,
    defaultPreviewValue: false,
  },
  {
    field: 'membershipLevel',
    labelKey: 'labels.membershipLevel',
    categories: ['chat', 'image', 'video', 'prompt'],
    control: 'enum-multi',
    condition: true,
    preview: true,
  },
];

export function pricingDimensionsForCategory(category: PricingTaskCategory) {
  return PRICING_DIMENSIONS.filter((dimension) =>
    dimension.categories.includes(category),
  );
}

export function pricingConditionFieldsForCategory(category: PricingTaskCategory) {
  return pricingDimensionsForCategory(category)
    .filter((dimension) => dimension.condition)
    .map((dimension) => dimension.field);
}

