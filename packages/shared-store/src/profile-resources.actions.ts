import {
  meApi,
  type MeTab,
  type PlatformStats,
  type ResourceType,
} from '@autix/sdk';
import { marketplaceActions } from './marketplace.actions';

export type { MeTab, PlatformStats, ResourceType } from '@autix/sdk';

export interface ProfileResourceItem {
  id?: string;
  resourceType?: ResourceType;
  resourceId?: string;
  resource?: {
    id: string;
    title: string;
    coverImage?: string | null;
    category?: string | null;
    pointsCost?: number;
    useCount?: number;
    status?: string;
    updatedAt?: string;
  };
  title?: string;
  coverImage?: string | null;
  category?: string | null;
  pointsCost?: number;
  useCount?: number;
  status?: string;
  updatedAt?: string;
  pointsPaid?: number;
  acquiredAt?: string;
  createdAt?: string;
  viewedAt?: string;
  generationType?: ResourceType;
  templateId?: string;
  template?: {
    title?: string;
    coverImage?: string | null;
    category?: string | null;
  };
}

export const profileResourcesActions = {
  listResources: async (
    tab: MeTab,
    params?: { page?: number; pageSize?: number },
  ): Promise<ProfileResourceItem[]> => {
    const res = await meApi.resources(tab, params);
    const data = res.data as { items?: ProfileResourceItem[] };
    return data.items ?? [];
  },
  getPlatformStats: () => marketplaceActions.getPlatformStats(),
};
