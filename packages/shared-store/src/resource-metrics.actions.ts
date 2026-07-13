import {
  favoriteResource,
  galleryApi,
  getResourceMetrics,
  imageTemplateApi,
  likeResource,
  shareResource,
  unfavoriteResource,
  unlikeResource,
  videoTemplateApi,
  type MetricResourceType,
  type ResourceMetrics,
} from '@autix/sdk';

export type { MetricResourceType, ResourceMetrics } from '@autix/sdk';

/** 专属互动端点回参形态：Gallery like/unlike 回完整指标；其余（模板 like、所有 favorite）回布尔态。 */
export type DedicatedInteractionResult =
  | ResourceMetrics
  | { liked: boolean }
  | { favorited: boolean };

/**
 * 一个资源类型的专属受守卫互动路由（like/unlike/favorite/unfavorite）统一形状。
 * 各类型的后端语义不同，在此归一化，调用方（useResourceInteractions）无需感知差异。
 */
interface DedicatedRouteApi {
  like: (id: string) => Promise<DedicatedInteractionResult>;
  unlike: (id: string) => Promise<DedicatedInteractionResult>;
  favorite: (id: string) => Promise<{ favorited: boolean }>;
  unfavorite: (id: string) => Promise<{ favorited: boolean }>;
}

/** marketplace 模板（image/video）：like 为 POST 切换（无 DELETE 反向），再次 POST 即取消。 */
type TemplateApi = typeof imageTemplateApi | typeof videoTemplateApi;
function templateRouteApi(api: TemplateApi): DedicatedRouteApi {
  return {
    like: (id) => api.like(id).then((r) => r.data),
    // 模板无 DELETE unlike 路由——再次 POST 同一 like 端点即切换为未点赞。
    unlike: (id) => api.like(id).then((r) => r.data),
    favorite: (id) => api.favorite(id).then((r) => r.data),
    unfavorite: (id) => api.unfavorite(id).then((r) => r.data),
  };
}

/** Gallery：like/unlike 为显式 POST/DELETE（回完整指标）；favorite/unfavorite 为显式 POST/DELETE。 */
const galleryRouteApi: DedicatedRouteApi = {
  like: (id) => galleryApi.like(id).then((r) => r.data),
  unlike: (id) => galleryApi.unlike(id).then((r) => r.data),
  favorite: (id) => galleryApi.favorite(id).then((r) => r.data),
  unfavorite: (id) => galleryApi.unfavorite(id).then((r) => r.data),
};

/**
 * Plan C Task 10：拥有专属受守卫互动路由的资源类型——IMAGE_TEMPLATE / VIDEO_TEMPLATE
 * （/marketplace/*-templates/:id，带公开可见守卫）与 GALLERY_POST（/gallery/:id，仅 PUBLISHED）。
 * 这些类型的 like/favorite 写入必须走各自专属端点；通用 /resources/:type/:id/{like,favorite}
 * 端点已对三者一律返回 400（见 services/api resource-metrics.controller assertNotDedicatedResource）。
 * SKILL / MCP / AGENT 无专属可见性守卫、继续走通用端点。
 */
const DEDICATED_INTERACTION_API = {
  IMAGE_TEMPLATE: templateRouteApi(imageTemplateApi),
  VIDEO_TEMPLATE: templateRouteApi(videoTemplateApi),
  GALLERY_POST: galleryRouteApi,
} as const;

export type DedicatedInteractionType = keyof typeof DEDICATED_INTERACTION_API;

export function hasDedicatedInteractionRoute(
  type: MetricResourceType,
): type is DedicatedInteractionType {
  return (
    type === 'IMAGE_TEMPLATE' || type === 'VIDEO_TEMPLATE' || type === 'GALLERY_POST'
  );
}

export const dedicatedInteractionActions = {
  like: (type: DedicatedInteractionType, id: string): Promise<DedicatedInteractionResult> =>
    DEDICATED_INTERACTION_API[type].like(id),
  unlike: (type: DedicatedInteractionType, id: string): Promise<DedicatedInteractionResult> =>
    DEDICATED_INTERACTION_API[type].unlike(id),
  favorite: (type: DedicatedInteractionType, id: string): Promise<{ favorited: boolean }> =>
    DEDICATED_INTERACTION_API[type].favorite(id),
  unfavorite: (type: DedicatedInteractionType, id: string): Promise<{ favorited: boolean }> =>
    DEDICATED_INTERACTION_API[type].unfavorite(id),
};

export const resourceMetricsActions = {
  getMetrics: async (type: MetricResourceType, id: string): Promise<ResourceMetrics> => {
    const res = await getResourceMetrics(type, id);
    return res.data;
  },
  like: async (type: MetricResourceType, id: string): Promise<ResourceMetrics> => {
    const res = await likeResource(type, id);
    return res.data;
  },
  unlike: async (type: MetricResourceType, id: string): Promise<ResourceMetrics> => {
    const res = await unlikeResource(type, id);
    return res.data;
  },
  favorite: async (type: MetricResourceType, id: string): Promise<ResourceMetrics> => {
    const res = await favoriteResource(type, id);
    return res.data;
  },
  unfavorite: async (type: MetricResourceType, id: string): Promise<ResourceMetrics> => {
    const res = await unfavoriteResource(type, id);
    return res.data;
  },
  share: async (type: MetricResourceType, id: string): Promise<ResourceMetrics> => {
    const res = await shareResource(type, id);
    return res.data;
  },
};
