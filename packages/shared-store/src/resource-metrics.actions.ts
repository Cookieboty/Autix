import {
  favoriteResource,
  getResourceMetrics,
  likeResource,
  shareResource,
  unfavoriteResource,
  unlikeResource,
  type ResourceMetrics,
  type ResourceType,
} from '@autix/sdk';

export type { ResourceMetrics, ResourceType } from '@autix/sdk';

export const resourceMetricsActions = {
  getMetrics: async (type: ResourceType, id: string): Promise<ResourceMetrics> => {
    const res = await getResourceMetrics(type, id);
    return res.data;
  },
  like: async (type: ResourceType, id: string): Promise<ResourceMetrics> => {
    const res = await likeResource(type, id);
    return res.data;
  },
  unlike: async (type: ResourceType, id: string): Promise<ResourceMetrics> => {
    const res = await unlikeResource(type, id);
    return res.data;
  },
  favorite: async (type: ResourceType, id: string): Promise<ResourceMetrics> => {
    const res = await favoriteResource(type, id);
    return res.data;
  },
  unfavorite: async (type: ResourceType, id: string): Promise<ResourceMetrics> => {
    const res = await unfavoriteResource(type, id);
    return res.data;
  },
  share: async (type: ResourceType, id: string): Promise<ResourceMetrics> => {
    const res = await shareResource(type, id);
    return res.data;
  },
};
