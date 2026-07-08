import type { ImageTemplate } from '@autix/shared-store';

export type ImageStudioMode = 'history' | 'templates';
// 5 档密度：xrelaxed = 图最大/列最少 … xdense = 图最小/列最多
export type TemplateDensity = 'xrelaxed' | 'relaxed' | 'normal' | 'dense' | 'xdense';
export type PublicUploadedReference = {
  id: string;
  url: string;
  name: string;
};
export type PublicVideoReference = PublicUploadedReference & {
  sourceType?: 'upload' | 'image_generation';
  sourceId?: string;
  prompt?: string;
};

export function createPublicImageDraftId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function imageTemplateCover(template: ImageTemplate) {
  return template.coverImage || template.exampleImages?.[0] || null;
}
