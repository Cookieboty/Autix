import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  publicGrowthActions,
  type PublicCollectionKind,
  type PublicCreationMediaType,
} from './public-growth.actions';

export const publicGrowthQueryKeys = {
  root: () => ['publicGrowth'] as const,
  home: (locale?: string) =>
    [...publicGrowthQueryKeys.root(), 'home', locale ?? 'default'] as const,
  page: (slug: string, locale?: string) =>
    [...publicGrowthQueryKeys.root(), 'page', slug, locale ?? 'default'] as const,
  collections: (kind?: PublicCollectionKind, locale?: string) => [
    ...publicGrowthQueryKeys.root(),
    'collections',
    kind ?? 'all',
    locale ?? 'default',
  ] as const,
  collection: (slug: string, locale?: string) =>
    [...publicGrowthQueryKeys.root(), 'collection', slug, locale ?? 'default'] as const,
  creations: (params?: {
    page?: number;
    pageSize?: number;
    mediaType?: PublicCreationMediaType;
    tag?: string;
    collectionSlug?: string;
  }) => [
    ...publicGrowthQueryKeys.root(),
    'creations',
    params?.page ?? 1,
    params?.pageSize ?? 24,
    params?.mediaType ?? 'all',
    params?.tag ?? '',
    params?.collectionSlug ?? '',
  ] as const,
  creation: (id: string) => [...publicGrowthQueryKeys.root(), 'creation', id] as const,
  creator: (handle: string) =>
    [...publicGrowthQueryKeys.root(), 'creator', handle] as const,
  creatorCreations: (handle: string, page = 1, pageSize = 24) =>
    [...publicGrowthQueryKeys.root(), 'creator', handle, 'creations', page, pageSize] as const,
};

export function usePublicGrowthHomeQuery(enabled = true, locale?: string) {
  return useQuery({
    queryKey: publicGrowthQueryKeys.home(locale),
    queryFn: () => publicGrowthActions.getHome(locale),
    enabled,
  });
}

export function usePublicGrowthPageQuery(slug: string, enabled = true, locale?: string) {
  return useQuery({
    queryKey: publicGrowthQueryKeys.page(slug, locale),
    queryFn: () => publicGrowthActions.getPage(slug, locale),
    enabled: enabled && Boolean(slug),
  });
}

export function usePublicCollectionsQuery(
  kind?: PublicCollectionKind,
  enabled = true,
  locale?: string,
) {
  return useQuery({
    queryKey: publicGrowthQueryKeys.collections(kind, locale),
    queryFn: () => publicGrowthActions.listCollections(kind, locale),
    enabled,
  });
}

export function usePublicCollectionQuery(slug: string, enabled = true, locale?: string) {
  return useQuery({
    queryKey: publicGrowthQueryKeys.collection(slug, locale),
    queryFn: () => publicGrowthActions.getCollection(slug, locale),
    enabled: enabled && Boolean(slug),
  });
}

export function usePublicCreationsQuery(
  params?: {
    page?: number;
    pageSize?: number;
    mediaType?: PublicCreationMediaType;
    tag?: string;
    collectionSlug?: string;
  },
  enabled = true,
) {
  return useQuery({
    queryKey: publicGrowthQueryKeys.creations(params),
    queryFn: () => publicGrowthActions.listCreations(params),
    enabled,
  });
}

export function usePublicCreationQuery(id: string, enabled = true) {
  return useQuery({
    queryKey: publicGrowthQueryKeys.creation(id),
    queryFn: () => publicGrowthActions.getCreation(id),
    enabled: enabled && Boolean(id),
  });
}

export function usePublicCreatorQuery(handle: string, enabled = true) {
  return useQuery({
    queryKey: publicGrowthQueryKeys.creator(handle),
    queryFn: () => publicGrowthActions.getCreator(handle),
    enabled: enabled && Boolean(handle),
  });
}

export function usePublicCreatorCreationsQuery(
  handle: string,
  params: { page?: number; pageSize?: number } = {},
  enabled = true,
) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 24;
  return useQuery({
    queryKey: publicGrowthQueryKeys.creatorCreations(handle, page, pageSize),
    queryFn: () => publicGrowthActions.getCreatorCreations(handle, { page, pageSize }),
    enabled: enabled && Boolean(handle),
  });
}

export function usePublicCreationLikeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: publicGrowthActions.likeCreation,
    onSuccess: async (_data, id) => {
      await queryClient.invalidateQueries({
        queryKey: publicGrowthQueryKeys.creation(id),
      });
      await queryClient.invalidateQueries({
        queryKey: publicGrowthQueryKeys.root(),
      });
    },
  });
}

export function usePublicCreatorFollowMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: publicGrowthActions.followCreator,
    onSuccess: async (_data, handle) => {
      await queryClient.invalidateQueries({
        queryKey: publicGrowthQueryKeys.creator(handle),
      });
    },
  });
}
