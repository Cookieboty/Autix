import {
  boostAdminApi,
  type CreateBoostInput,
  type MetricResourceType,
  type ResourceBoostAdminItem,
  type UpdateBoostInput,
} from '@autix/sdk';

export type { CreateBoostInput, ResourceBoostAdminItem, UpdateBoostInput };
export type { BoostReason } from '@autix/sdk';

export const boostAdminActions = {
  list: async (params?: {
    type?: MetricResourceType;
    query?: string;
  }): Promise<ResourceBoostAdminItem[]> => {
    const { data } = await boostAdminApi.list(params);
    return data;
  },
  create: (resourceType: MetricResourceType, resourceId: string, data: CreateBoostInput) =>
    boostAdminApi.create(resourceType, resourceId, data),
  update: (id: string, data: UpdateBoostInput) => boostAdminApi.update(id, data),
  revoke: (id: string) => boostAdminApi.revoke(id),
};
