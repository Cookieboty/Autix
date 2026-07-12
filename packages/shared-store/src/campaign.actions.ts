import { campaignApi } from '@autix/sdk';
import type { HomeStarterClaimResult, HomeStarterTask, HomeStarterTasksResult } from '@autix/sdk';

export type { HomeStarterClaimResult, HomeStarterTask, HomeStarterTasksResult } from '@autix/sdk';

export const campaignActions = {
  getHomeStarterTasks: async (): Promise<HomeStarterTasksResult> => {
    const res = await campaignApi.getHomeStarterTasks();
    return res.data;
  },
  claimHomeStarterTask: async (code: string): Promise<HomeStarterClaimResult> => {
    const res = await campaignApi.claimHomeStarterTask(code);
    return res.data;
  },
};
