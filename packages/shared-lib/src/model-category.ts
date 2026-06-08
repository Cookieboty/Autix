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
