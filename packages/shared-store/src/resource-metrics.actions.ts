import {
  favoriteResource,
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

/**
 * Plan C Task 10：拥有专属受守卫收藏/点赞路由的资源类型（IMAGE_TEMPLATE / VIDEO_TEMPLATE）。
 * 这些类型的 like/favorite 写入必须走各自 /marketplace/*-templates/:id 的专属端点
 * （带公开可见守卫，Plan B Task 5）；通用 /resources/:type/:id/{like,favorite} 端点已对
 * 它们返回 400（见 services/api resource-metrics.controller assertNotDedicatedResource）。
 * SKILL / MCP / AGENT 无专属可见性守卫、继续走通用端点。
 *
 * 语义差异（对齐后端）：
 * - like 走专属端点仍是 POST 切换（无 DELETE 反向路由）——再次 POST 即取消，故 like/unlike
 *   都打同一个 POST，靠调用方本地 liked 态决定方向。
 * - favorite 走专属端点是显式命令：POST=收藏、DELETE=取消收藏（幂等）。
 */
const DEDICATED_INTERACTION_API = {
  IMAGE_TEMPLATE: imageTemplateApi,
  VIDEO_TEMPLATE: videoTemplateApi,
} as const;

export type DedicatedInteractionType = keyof typeof DEDICATED_INTERACTION_API;

export function hasDedicatedInteractionRoute(
  type: MetricResourceType,
): type is DedicatedInteractionType {
  return type === 'IMAGE_TEMPLATE' || type === 'VIDEO_TEMPLATE';
}

export const dedicatedInteractionActions = {
  /** POST 专属 like 端点（切换语义）；返回切换后的 liked 态。 */
  toggleLike: async (type: DedicatedInteractionType, id: string): Promise<{ liked: boolean }> => {
    const res = await DEDICATED_INTERACTION_API[type].like(id);
    return res.data;
  },
  favorite: async (
    type: DedicatedInteractionType,
    id: string,
  ): Promise<{ favorited: boolean }> => {
    const res = await DEDICATED_INTERACTION_API[type].favorite(id);
    return res.data;
  },
  unfavorite: async (
    type: DedicatedInteractionType,
    id: string,
  ): Promise<{ favorited: boolean }> => {
    const res = await DEDICATED_INTERACTION_API[type].unfavorite(id);
    return res.data;
  },
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
