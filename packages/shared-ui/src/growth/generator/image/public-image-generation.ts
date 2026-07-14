import type {
  TaskEstimateInput,
  ModelConfigItem,
  PublicImageGenerateResult,
  ImageGenerationGalleryPost,
} from '@autix/shared-store';

/**
 * 生成/报价参数 —— 第 2 期起是**透传的 schema 参数 bag**，不再是固定字段集合
 * （size / quality / guidanceScale / steps / promptTuning / stylePreset / ...）。
 * 唯一保留的已知键是 size / quality：下游（历史回填、尺寸比例解析）还要显示它们，
 * 其余键（包括 schema 新增的任何参数）经由索引签名透传，不需要这里跟着改。
 */
export interface PublicImageGenerationSettings extends Record<string, unknown> {
  size: string;
  quality?: string;
}

export interface PublicImageGenerationPayload {
  prompt: string;
  referenceImages: string[];
  settings: Record<string, unknown>;
  model: string;
  visibility: 'private' | 'public';
}

export interface PublicImageHistoryImage {
  url: string;
  prompt?: string;
  generationId?: string;
  index: number;
}

export interface PublicImageHistoryItem {
  id: string;
  prompt: string;
  model: string;
  createdAt: string;
  images: PublicImageHistoryImage[];
  settings: Record<string, unknown>;
  /** 该次生成当前活着的广场帖（status <> REMOVED）；没有投稿过则缺省。 */
  galleryPost?: ImageGenerationGalleryPost;
}

/**
 * 生成请求的 settings —— **透传 schema 参数**，不再是固定 9 字段。
 * 报价用的 params 与这里发出去的 settings 必须是同一个对象（spec §11 第 2 期第 7 条）：
 * 服务端拿它跑 applyParamDefaults → deriveParams → validateParams → pickWireParams。
 * skipPromptTuning: true 是唯一保留的固定字段——公开生成器从不做服务端 prompt 调优。
 */
export function buildPublicImageGenerationSettings(
  params: Record<string, unknown>,
): Record<string, unknown> {
  return { ...params, skipPromptTuning: true };
}

/**
 * 报价输入 —— params 直接透传（不再手算 resolution：那是派生参数，服务端从 size
 * 派生，spec §6.3）。referenceImages 是隐藏计价参数，表单里恒为 schema 默认值 0，
 * 这里用调用方传入的真实上传张数覆盖，和 buildPublicImageGenerationSettings 用的
 * 是同一个 params 对象（同一次渲染里的同一个 form.params 引用）。
 */
export function buildPublicImageEstimateInput({
  params,
  model,
  selectedModelId,
  referenceImages,
}: {
  params: Record<string, unknown>;
  model?: ModelConfigItem | null;
  selectedModelId?: string;
  referenceImages: number;
}): TaskEstimateInput {
  return {
    taskType: 'image_generation',
    modelConfigId: model?.id ?? selectedModelId ?? '',
    params: { ...params, referenceImages },
  };
}

export function buildPublicImageHistoryItem({
  data,
  request,
  createdAt,
}: {
  data: PublicImageGenerateResult;
  request: PublicImageGenerationPayload;
  createdAt: string;
}): PublicImageHistoryItem {
  const fallbackId = `public-image-${Date.now()}`;
  const images = (data.images ?? []).map((image, index) => ({
    url: image.url,
    prompt: image.prompt ?? data.prompt ?? request.prompt,
    generationId: image.generationId ?? fallbackId,
    index: image.index ?? index,
  }));

  return {
    id: images[0]?.generationId ?? fallbackId,
    prompt: data.prompt ?? request.prompt,
    model: data.model ?? request.model,
    createdAt,
    images,
    settings: request.settings,
  };
}
