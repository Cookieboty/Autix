import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { boostAdminActions } from './boost-admin.actions';
import type { CreateBoostInput, UpdateBoostInput } from './boost-admin.actions';
import type { MetricResourceType } from '@autix/sdk';

type MutationCallbacks = {
  onSuccess?: () => void | Promise<void>;
  onError?: (error: unknown) => void;
};

export const boostAdminQueryKeys = {
  listRoot: () => ['boostAdmin', 'list'] as const,
  list: (type?: MetricResourceType, query?: string) =>
    ['boostAdmin', 'list', type ?? '', query ?? ''] as const,
};

function callOnSuccess(callbacks?: MutationCallbacks) {
  return callbacks?.onSuccess?.();
}

function callOnError(error: unknown, callbacks?: MutationCallbacks) {
  return callbacks?.onError?.(error);
}

export function useBoostsList(params?: { type?: MetricResourceType; query?: string }) {
  return useQuery({
    queryKey: boostAdminQueryKeys.list(params?.type, params?.query),
    queryFn: () => boostAdminActions.list(params),
  });
}

/** 内容加热操作集合：create/update/revoke，成功后失效加热列表。 */
export function useBoostAdmin(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();

  const invalidateList = () =>
    queryClient.invalidateQueries({
      queryKey: boostAdminQueryKeys.listRoot(),
    });

  const create = useMutation({
    mutationFn: ({
      resourceType,
      resourceId,
      data,
    }: {
      resourceType: MetricResourceType;
      resourceId: string;
      data: CreateBoostInput;
    }) => boostAdminActions.create(resourceType, resourceId, data),
    onSuccess: async () => {
      await invalidateList();
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBoostInput }) =>
      boostAdminActions.update(id, data),
    onSuccess: async () => {
      await invalidateList();
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => boostAdminActions.revoke(id),
    onSuccess: async () => {
      await invalidateList();
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });

  return { create, update, revoke };
}
