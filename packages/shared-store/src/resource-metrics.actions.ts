import {
  favoriteResource,
  getResourceMetrics,
  likeResource,
  shareResource,
  unfavoriteResource,
  unlikeResource,
  type MetricResourceType,
  type ResourceMetrics,
} from '@autix/sdk';

export type { MetricResourceType, ResourceMetrics } from '@autix/sdk';

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
