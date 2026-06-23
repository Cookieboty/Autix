import type {
  ImageWorkbenchHistoryItem,
  ModelConfigItem,
} from '@autix/shared-store';

export interface ImageStudioReference {
  url: string;
  prompt?: string;
  generationId?: string;
  index?: number;
  annotationKey?: string;
}

export interface ImageStudioModelSettings {
  size: string;
  quality: string;
  count: number;
  guidanceScale: number;
  steps: number;
  seed: string;
  promptTuning: string;
  stylePreset: string;
  negativePrompt: string;
}

export interface ImageStudioPromptRefinement {
  originalPrompt: string;
  composedPrompt: string;
  refinedPrompt: string;
  additions: string[];
  model?: string;
  chatModel?: string;
}

export interface AnnotationTarget {
  url: string;
  prompt?: string;
  label: string;
  annotationKey: string;
  overlayUrl?: string;
}

export interface ImageAnnotationResult {
  targetUrl: string;
  targetKey: string;
  overlayUrl: string;
  mergedUrl?: string;
  note: string;
}

export interface ReferenceAnnotation {
  overlayUrl: string;
  mergedUrl: string;
  note: string;
}

export interface UploadedReference {
  url: string;
  label: string;
  annotationKey?: string;
}

export interface ImageStudioRequestInputs {
  sourceImages: ImageStudioReference[];
  inputImages: string[];
  isEditMode: boolean;
}

export interface AnnotationBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface MarkHistoryEntry {
  imageData: ImageData;
  bounds: AnnotationBounds | null;
}

export type InspirationTab = 'history' | 'materials' | 'templates';

export const STYLE_PRESET_VALUES = [
  'general',
  'commercial',
  'cinematic',
  'productPoster',
  'chineseIllustration',
  'interior',
  'character',
  'sticker',
] as const;

export type StylePresetValue = (typeof STYLE_PRESET_VALUES)[number];

export const PROMPT_TUNING_VALUES = [
  'auto',
  'faithful',
  'photoDetail',
  'ecommerce',
  'storyMood',
  'minimal',
] as const;

export type PromptTuningValue = (typeof PROMPT_TUNING_VALUES)[number];

export const TEMPLATE_SORT_VALUES = ['popular', 'newest', 'likes'] as const;

export type TemplateSortValue = (typeof TEMPLATE_SORT_VALUES)[number];

export const ANNOTATION_COLOR_VALUES = [
  'red',
  'yellow',
  'cyan',
  'green',
  'purple',
  'white',
] as const;

export type AnnotationColorValue = (typeof ANNOTATION_COLOR_VALUES)[number];

export const ANNOTATION_COLOR_DEFINITIONS: Array<{
  key: AnnotationColorValue;
  value: string;
  swatch: string;
}> = [
    { key: 'red', value: 'rgba(255, 60, 60, 0.88)', swatch: '#ff3c3c' },
    { key: 'yellow', value: 'rgba(250, 204, 21, 0.9)', swatch: '#facc15' },
    { key: 'cyan', value: 'rgba(34, 211, 238, 0.9)', swatch: '#22d3ee' },
    { key: 'green', value: 'rgba(74, 222, 128, 0.9)', swatch: '#4ade80' },
    { key: 'purple', value: 'rgba(168, 85, 247, 0.9)', swatch: '#a855f7' },
    { key: 'white', value: 'rgba(255, 255, 255, 0.92)', swatch: '#ffffff' },
  ];

export const promptToolbarControlClass =
  'inline-flex h-10 w-[150px] shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium shadow-none transition-colors';

export function resolveReferenceAnnotationKey(
  ref: Pick<ImageStudioReference | UploadedReference, 'url' | 'annotationKey'> & {
    generationId?: string;
    index?: number;
  },
  fallbackIndex?: number,
): string {
  if (ref.annotationKey) return ref.annotationKey;
  if (ref.generationId) return `generation:${ref.generationId}:${ref.index ?? fallbackIndex ?? 0}`;
  return `url:${ref.url}:${fallbackIndex ?? 0}`;
}

export function readFilesAsDataUrls(files: File[]) {
  return Promise.all(
    files.map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result ?? ''));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        }),
    ),
  );
}

export function resolveImageStudioRequestInputs({
  selectedSourceImages,
  uploadedRefs,
  referenceAnnotations,
}: {
  selectedSourceImages: ImageStudioReference[];
  uploadedRefs: UploadedReference[];
  referenceAnnotations: Record<string, ReferenceAnnotation>;
}): ImageStudioRequestInputs {
  const sourceImagesFromEditor = selectedSourceImages.map((image, index) => {
    const annotationKey = resolveReferenceAnnotationKey(image, index);
    const annotation = referenceAnnotations[annotationKey];
    if (!annotation) return image;
    return {
      ...image,
      url: annotation.mergedUrl,
      prompt: [image.prompt, annotation.note].filter(Boolean).join('\n'),
    };
  });
  const annotatedUploadSources =
    selectedSourceImages.length === 0
      ? uploadedRefs.flatMap((ref, index) => {
        const annotation = referenceAnnotations[resolveReferenceAnnotationKey(ref, index)];
        return annotation
          ? [{ url: annotation.mergedUrl, prompt: annotation.note, index }]
          : [];
      })
      : [];
  const inputImages = uploadedRefs
    .filter((ref, index) => !(annotatedUploadSources.length > 0 && referenceAnnotations[resolveReferenceAnnotationKey(ref, index)]))
    .map((ref, index) => referenceAnnotations[resolveReferenceAnnotationKey(ref, index)]?.mergedUrl ?? ref.url);
  const sourceImages = [
    ...sourceImagesFromEditor,
    ...annotatedUploadSources,
  ];

  return {
    sourceImages,
    inputImages,
    isEditMode: sourceImages.length > 0,
  };
}

function numberSetting(value: unknown, fallback: number) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function stringSetting(value: unknown, fallback: string) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
}

export function mergeHistorySettings(
  current: ImageStudioModelSettings,
  item: ImageWorkbenchHistoryItem,
  _maxCount: number,
): ImageStudioModelSettings {
  const raw = item.settings ?? {};
  return {
    size: stringSetting(raw.size, current.size),
    quality: stringSetting(raw.quality, current.quality),
    count: 1,
    guidanceScale: numberSetting(raw.guidanceScale, current.guidanceScale),
    steps: numberSetting(raw.steps, current.steps),
    seed: stringSetting(raw.seed, ''),
    promptTuning: stringSetting(raw.promptTuning, current.promptTuning),
    stylePreset: stringSetting(raw.stylePreset, current.stylePreset),
    negativePrompt: stringSetting(raw.negativePrompt, ''),
  };
}

export interface ModelProviderLabelMessages {
  unselected: string;
}

export function modelProviderLabel(
  model: ModelConfigItem | null | undefined,
  messages: ModelProviderLabelMessages,
) {
  if (!model) return messages.unselected;
  const raw = `${model.provider} ${model.model}`.toLowerCase();
  if (raw.includes('gemini')) return 'Gemini';
  if (raw.includes('gpt') || raw.includes('openai')) return 'GPT Image';
  if (raw.includes('dall')) return 'DALL-E';
  return model.provider || model.type || 'Image';
}

export function resolveTemplatePrompt(template: {
  prompt?: string;
  variables?: Array<{ key: string; default?: string; label?: string }>;
}) {
  let nextPrompt = template.prompt ?? '';
  for (const variable of template.variables ?? []) {
    const fallback = variable.default || variable.label || variable.key;
    nextPrompt = nextPrompt.replaceAll(`{{${variable.key}}}`, fallback);
  }
  return nextPrompt.trim();
}

export function cloneAnnotationBounds(bounds: AnnotationBounds | null): AnnotationBounds | null {
  return bounds ? { ...bounds } : null;
}

export function mergeAnnotationBounds(boundsList: AnnotationBounds[]): AnnotationBounds | null {
  if (boundsList.length === 0) return null;
  return boundsList.reduce<AnnotationBounds>(
    (merged, bounds) => ({
      minX: Math.min(merged.minX, bounds.minX),
      minY: Math.min(merged.minY, bounds.minY),
      maxX: Math.max(merged.maxX, bounds.maxX),
      maxY: Math.max(merged.maxY, bounds.maxY),
    }),
    { ...boundsList[0] },
  );
}

export interface AnnotationPositionMessages {
  left: string;
  right: string;
  top: string;
  bottom: string;
  centerHorizontal: string;
  centerVertical: string;
  full: string;
  horizontalOnly: (vertical: string) => string;
  verticalOnly: (horizontal: string) => string;
  combined: (vertical: string, horizontal: string) => string;
}

export function describeAnnotationPosition(
  bounds: AnnotationBounds,
  width: number,
  height: number,
  messages: AnnotationPositionMessages,
) {
  const centerX = ((bounds.minX + bounds.maxX) / 2) / Math.max(width, 1);
  const centerY = ((bounds.minY + bounds.maxY) / 2) / Math.max(height, 1);
  const horizontal =
    centerX < 0.33 ? messages.left : centerX > 0.67 ? messages.right : messages.centerHorizontal;
  const vertical =
    centerY < 0.33 ? messages.top : centerY > 0.67 ? messages.bottom : messages.centerVertical;

  if (horizontal === messages.centerHorizontal && vertical === messages.centerVertical) {
    return messages.full;
  }
  if (horizontal === messages.centerHorizontal) return messages.horizontalOnly(vertical);
  if (vertical === messages.centerVertical) return messages.verticalOnly(horizontal);
  return messages.combined(vertical, horizontal);
}

export interface AnnotationPromptMessages {
  position: AnnotationPositionMessages;
  stripLabelSuffix?: string;
  noRegion: (label: string) => string;
  singleRegion: (params: { label: string; region: string }) => string;
  multiRegion: (params: { label: string; count: number; regions: string }) => string;
  regionDescription: (params: {
    position: string;
    widthPercent: number;
    heightPercent: number;
  }) => string;
  regionDescriptionWithIndex: (params: {
    index: number;
    position: string;
    widthPercent: number;
    heightPercent: number;
  }) => string;
}

export function buildAnnotationPromptNote(
  label: string,
  regions: AnnotationBounds[],
  width: number,
  height: number,
  messages: AnnotationPromptMessages,
) {
  const cleanLabel = messages.stripLabelSuffix
    ? label.replace(new RegExp(`${messages.stripLabelSuffix}$`), '')
    : label;
  const firstRegion = regions[0];
  if (!firstRegion) {
    return messages.noRegion(cleanLabel);
  }
  const describeRegion = (bounds: AnnotationBounds, index?: number) => {
    const position = describeAnnotationPosition(bounds, width, height, messages.position);
    const widthPercent = Math.max(
      1,
      Math.round(((bounds.maxX - bounds.minX) / Math.max(width, 1)) * 100),
    );
    const heightPercent = Math.max(
      1,
      Math.round(((bounds.maxY - bounds.minY) / Math.max(height, 1)) * 100),
    );
    return typeof index === 'number'
      ? messages.regionDescriptionWithIndex({
        index: index + 1,
        position,
        widthPercent,
        heightPercent,
      })
      : messages.regionDescription({ position, widthPercent, heightPercent });
  };

  if (regions.length <= 1) {
    return messages.singleRegion({
      label: cleanLabel,
      region: describeRegion(firstRegion),
    });
  }

  return messages.multiRegion({
    label: cleanLabel,
    count: regions.length,
    regions: regions.map(describeRegion).join('；'),
  });
}

export interface AppendPromptNoteMessages {
  emptyPromptSuffix: string;
}

export function appendEditablePromptNote(
  prompt: string,
  note: string,
  previousNote: string | undefined,
  messages: AppendPromptNoteMessages,
) {
  const normalizedPrompt = previousNote
    ? prompt.replace(previousNote, '').replace(/\n{3,}/g, '\n\n').trimEnd()
    : prompt.trimEnd();
  const trimmed = normalizedPrompt.trimEnd();
  if (!trimmed) {
    return `${note}\n${messages.emptyPromptSuffix}`;
  }
  return `${trimmed}\n\n${note}`;
}
