import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { galleryAdminActions } from './gallery-admin.actions';

type MutationCallbacks = {
  onSuccess?: () => void | Promise<void>;
  onError?: (error: unknown) => void;
};

export const galleryAdminQueryKeys = {
  pendingRoot: () => ['galleryAdmin', 'pending'] as const,
  pending: (cursor?: string) =>
    ['galleryAdmin', 'pending', cursor ?? ''] as const,
};

function callOnSuccess(callbacks?: MutationCallbacks) {
  return callbacks?.onSuccess?.();
}

function callOnError(error: unknown, callbacks?: MutationCallbacks) {
  return callbacks?.onError?.(error);
}

export function useGalleryPendingQueue(cursor?: string) {
  return useQuery({
    queryKey: galleryAdminQueryKeys.pending(cursor),
    queryFn: () => galleryAdminActions.listPending(cursor),
  });
}

/** 广场审核操作集合：approve/reject/hide/remove/resolveReport，成功后失效待审队列。 */
export function useGalleryModeration(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();

  const invalidatePending = () =>
    queryClient.invalidateQueries({
      queryKey: galleryAdminQueryKeys.pendingRoot(),
    });

  const approve = useMutation({
    mutationFn: (id: string) => galleryAdminActions.approve(id),
    onSuccess: async () => {
      await invalidatePending();
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      galleryAdminActions.reject(id, reason),
    onSuccess: async () => {
      await invalidatePending();
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });

  const hide = useMutation({
    mutationFn: (id: string) => galleryAdminActions.hide(id),
    onSuccess: async () => {
      await invalidatePending();
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });

  const remove = useMutation({
    mutationFn: (id: string) => galleryAdminActions.remove(id),
    onSuccess: async () => {
      await invalidatePending();
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });

  const resolveReport = useMutation({
    mutationFn: ({
      reportId,
      status,
    }: {
      reportId: string;
      status: 'RESOLVED' | 'DISMISSED';
    }) => galleryAdminActions.resolveReport(reportId, status),
    onSuccess: async () => {
      await invalidatePending();
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });

  return { approve, reject, hide, remove, resolveReport };
}
