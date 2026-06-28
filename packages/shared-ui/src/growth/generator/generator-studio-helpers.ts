import type { ImageTemplate } from '@autix/shared-store';

export type ImageStudioMode = 'history' | 'templates';
export type TemplateDensity = 'relaxed' | 'normal' | 'dense';
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
