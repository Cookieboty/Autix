import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { featuredSlotsAdminActions } from './featured-slots-admin.actions';
import type { CreateFeaturedSlotInput, UpdateFeaturedSlotInput } from './featured-slots-admin.actions';

type MutationCallbacks = {
  onSuccess?: () => void | Promise<void>;
  onError?: (error: unknown) => void;
};

export const featuredSlotsAdminQueryKeys = {
  listRoot: () => ['featuredSlotsAdmin', 'list'] as const,
  list: (placement: string) => ['featuredSlotsAdmin', 'list', placement] as const,
};

function callOnSuccess(callbacks?: MutationCallbacks) {
  return callbacks?.onSuccess?.();
}

function callOnError(error: unknown, callbacks?: MutationCallbacks) {
  return callbacks?.onError?.(error);
}

export function useFeaturedSlotsList(placement: string) {
  return useQuery({
    queryKey: featuredSlotsAdminQueryKeys.list(placement),
    queryFn: () => featuredSlotsAdminActions.list(placement),
  });
}

export function useFeaturedSlotCandidates(
  resourceType: 'IMAGE_TEMPLATE' | 'VIDEO_TEMPLATE' | 'GALLERY_POST',
  query: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['featuredSlotsAdmin', 'candidates', resourceType, query] as const,
    queryFn: () => featuredSlotsAdminActions.candidates(resourceType, query),
    enabled,
  });
}

/** 运营位编排操作集合：create/update/remove/reorder，成功后失效对应 placement 列表。 */
export function useFeaturedSlotsAdmin(placement: string, callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();

  const invalidateList = () =>
    queryClient.invalidateQueries({
      queryKey: featuredSlotsAdminQueryKeys.list(placement),
    });

  const create = useMutation({
    mutationFn: (data: CreateFeaturedSlotInput) => featuredSlotsAdminActions.create(data),
    onSuccess: async () => {
      await invalidateList();
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateFeaturedSlotInput }) =>
      featuredSlotsAdminActions.update(id, data),
    onSuccess: async () => {
      await invalidateList();
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });

  const remove = useMutation({
    mutationFn: (id: string) => featuredSlotsAdminActions.remove(id),
    onSuccess: async () => {
      await invalidateList();
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });

  const reorder = useMutation({
    mutationFn: (orderedIds: string[]) =>
      featuredSlotsAdminActions.reorder(placement, orderedIds),
    onSuccess: async () => {
      await invalidateList();
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });

  return { create, update, remove, reorder };
}
