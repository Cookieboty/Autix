import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { publicGrowthActions, type PublicCollectionKind } from './public-growth.actions';

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
  creator: (handle: string) =>
    [...publicGrowthQueryKeys.root(), 'creator', handle] as const,
  homeStarter: () => [...publicGrowthQueryKeys.root(), 'home-starter'] as const,
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

export function usePublicCreatorQuery(handle: string, enabled = true) {
  return useQuery({
    queryKey: publicGrowthQueryKeys.creator(handle),
    queryFn: () => publicGrowthActions.getCreator(handle),
    enabled: enabled && Boolean(handle),
  });
}

export function useHomeStarterTasksQuery(enabled = true) {
  return useQuery({
    queryKey: publicGrowthQueryKeys.homeStarter(),
    queryFn: publicGrowthActions.getHomeStarterTasks,
    enabled,
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

export function useClaimHomeStarterTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: publicGrowthActions.claimHomeStarterTask,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: publicGrowthQueryKeys.homeStarter(),
      });
    },
  });
}
