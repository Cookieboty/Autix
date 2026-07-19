import type { ImageTemplate } from '@autix/shared-store';

export type ImageStudioMode = 'history' | 'gallery';
// 5 档密度：xrelaxed = 图最大/列最少 … xdense = 图最小/列最多
export type TemplateDensity = 'xrelaxed' | 'relaxed' | 'normal' | 'dense' | 'xdense';
export type PublicUploadedReference = {
  id: string;
  url: string;
  name: string;
};
export type PublicVideoReference = PublicUploadedReference & {
  /**
   * 素材来源。'library' = 来自素材库（Uploads tab），
   * 'image_generation' / 'video_generation' = 用户自己的生成记录。
   * 注意：旧代码用 `sourceType !== 'image_generation'` 反向判断"是否上传"，
   * 来源变多后该写法已失效，请显式判断。
   */
  sourceType?: 'upload' | 'library' | 'image_generation' | 'video_generation';
  sourceId?: string;
  prompt?: string;
  /** 媒体类型：决定卡片用 img 还是 video 渲染，以及下发时的素材 role */
  mediaType?: 'image' | 'video' | 'audio';
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
