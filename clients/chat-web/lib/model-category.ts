export type ModelCategory = 'text' | 'multimodal-image' | 'multimodal-video';

export function getModelCategory(capabilities: string[]): ModelCategory {
  if (capabilities.includes('video')) return 'multimodal-video';
  if (capabilities.includes('vision') || capabilities.includes('image'))
    return 'multimodal-image';
  return 'text';
}

export const CATEGORY_LABELS: Record<ModelCategory, string> = {
  text: '文本 Text',
  'multimodal-image': '多模态图片 Image',
  'multimodal-video': '多模态视频 Video',
};

export const ALL_CATEGORIES: ModelCategory[] = [
  'text',
  'multimodal-image',
  'multimodal-video',
];
