import {
  imageGenerationApi,
  publicGrowthApi,
  videoProjectApi,
  type PublicCollectionDetail,
  type PublicCollectionKind,
  type PublicCreationMediaType,
  type PublicCreatorDetail,
  type PublicGrowthCollection,
  type PublicGrowthEventInput,
  type PublicGrowthHome,
  type PublicGrowthMediaItem,
  type PublicGrowthPage,
  type PublishPublicCreationInput,
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
  PublicPromptVisibility,
  PublishPublicCreationInput,
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
  listCreations: async (params?: {
    page?: number;
    pageSize?: number;
    mediaType?: PublicCreationMediaType;
    tag?: string;
    collectionSlug?: string;
  }) => {
    const res = await publicGrowthApi.creations(params);
    return res.data;
  },
  getCreation: async (id: string): Promise<PublicGrowthMediaItem> => {
    const res = await publicGrowthApi.creation(id);
    return res.data;
  },
  recordView: async (id: string) => {
    const res = await publicGrowthApi.viewCreation(id);
    return res.data;
  },
  likeCreation: async (id: string) => {
    const res = await publicGrowthApi.likeCreation(id);
    return res.data;
  },
  recordShare: async (id: string) => {
    const res = await publicGrowthApi.shareCreation(id);
    return res.data;
  },
  getCreator: async (handle: string): Promise<PublicCreatorDetail> => {
    const res = await publicGrowthApi.creator(handle);
    return res.data;
  },
  getCreatorCreations: async (handle: string, params?: { page?: number; pageSize?: number }) => {
    const res = await publicGrowthApi.creatorCreations(handle, params);
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
  publishImageGeneration: async (
    generationId: string,
    input: PublishPublicCreationInput,
  ): Promise<PublicGrowthMediaItem> => {
    const res = await imageGenerationApi.publish(generationId, input);
    return res.data;
  },
  publishVideoProject: async (
    projectId: string,
    input: PublishPublicCreationInput,
  ): Promise<PublicGrowthMediaItem> => {
    const res = await videoProjectApi.publish(projectId, input);
    return res.data;
  },
};
