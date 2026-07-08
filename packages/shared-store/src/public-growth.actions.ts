import {
  campaignApi,
  publicGrowthApi,
  type HomeStarterClaimResult,
  type HomeStarterTasksResult,
  type PublicCollectionDetail,
  type PublicCollectionKind,
  type PublicCreatorDetail,
  type PublicGrowthCollection,
  type PublicGrowthEventInput,
  type PublicGrowthHome,
  type PublicGrowthPage,
} from '@autix/sdk';

export type {
  PublicCollectionDetail,
  PublicCollectionKind,
  PublicCreationMediaType,
  PublicCreatorDetail,
  PublicCreatorProfile,
  PublicGrowthAuthor,
  PublicGrowthCollection,
  PublicGrowthEventInput,
  PublicGrowthFeature,
  PublicGrowthHome,
  PublicGrowthHomeSection,
  PublicGrowthMediaItem,
  PublicGrowthPage,
  HomeStarterClaimResult,
  HomeStarterTask,
  HomeStarterTaskStatus,
  HomeStarterTasksResult,
} from '@autix/sdk';

export const publicGrowthActions = {
  getHome: async (locale?: string): Promise<PublicGrowthHome> => {
    const res = await publicGrowthApi.home(locale ? { locale } : undefined);
    return res.data;
  },
  getPage: async (slug: string, locale?: string): Promise<PublicGrowthPage> => {
    const res = await publicGrowthApi.page(slug, locale ? { locale } : undefined);
    return res.data;
  },
  listCollections: async (
    kind?: PublicCollectionKind,
    locale?: string,
  ): Promise<PublicGrowthCollection[]> => {
    const res = await publicGrowthApi.collections({
      ...(kind ? { kind } : {}),
      ...(locale ? { locale } : {}),
    });
    return res.data;
  },
  getCollection: async (slug: string, locale?: string): Promise<PublicCollectionDetail> => {
    const res = await publicGrowthApi.collection(slug, locale ? { locale } : undefined);
    return res.data;
  },
  getCreator: async (handle: string): Promise<PublicCreatorDetail> => {
    const res = await publicGrowthApi.creator(handle);
    return res.data;
  },
  followCreator: async (handle: string) => {
    const res = await publicGrowthApi.followCreator(handle);
    return res.data;
  },
  recordEvent: async (input: PublicGrowthEventInput) => {
    const res = await publicGrowthApi.event(input);
    return res.data;
  },
  getHomeStarterTasks: async (): Promise<HomeStarterTasksResult> => {
    const res = await campaignApi.getHomeStarterTasks();
    return res.data;
  },
  claimHomeStarterTask: async (code: string): Promise<HomeStarterClaimResult> => {
    const res = await campaignApi.claimHomeStarterTask(code);
    return res.data;
  },
};
