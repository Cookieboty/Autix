export type ModelCategory = 'multimodal' | 'image';

export function getModelCategory(capabilities: string[]): ModelCategory {
  if (
    capabilities.includes('image') &&
    !capabilities.includes('text') &&
    !capabilities.includes('vision')
  ) {
    return 'image';
  }
  return 'multimodal';
}

export const CATEGORY_LABELS: Record<ModelCategory, string> = {
  multimodal: '多模态',
  image: '图片模型',
};

export const ALL_CATEGORIES: ModelCategory[] = [
  'multimodal',
  'image',
];

export function isVideoModel(model: {
  type?: string | null;
  model?: string | null;
  provider?: string | null;
  capabilities?: string[] | null;
}): boolean {
  const caps = model.capabilities ?? [];
  const modelName = (model.model ?? '').toLowerCase();
  const provider = (model.provider ?? '').toLowerCase();

  return (
    model.type === 'video' ||
    caps.includes('video') ||
    caps.includes('video_generation') ||
    caps.includes('video-generation') ||
    provider.includes('seedance') ||
    modelName.includes('seedance') ||
    modelName.includes('video')
  );
}
