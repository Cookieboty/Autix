import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { galleryAdminActions } from './gallery-admin.actions';
import type { GalleryAdminStatus } from './gallery-admin.actions';

type MutationCallbacks = {
  onSuccess?: () => void | Promise<void>;
  onError?: (error: unknown) => void;
};

export const galleryAdminQueryKeys = {
  root: () => ['galleryAdmin'] as const,
  pendingRoot: () => ['galleryAdmin', 'pending'] as const,
  pending: (cursor?: string) =>
    ['galleryAdmin', 'pending', cursor ?? ''] as const,
  byStatusRoot: (status: GalleryAdminStatus) =>
    ['galleryAdmin', 'byStatus', status] as const,
  byStatus: (status: GalleryAdminStatus, cursor?: string) =>
    ['galleryAdmin', 'byStatus', status, cursor ?? ''] as const,
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

/** 按状态分页查询（已审核 tab 等），按 status 独立缓存。 */
export function useGalleryByStatus(status: GalleryAdminStatus, cursor?: string) {
  return useQuery({
    queryKey: galleryAdminQueryKeys.byStatus(status, cursor),
    queryFn: () => galleryAdminActions.listByStatus(status, cursor),
  });
}

/** 广场审核操作集合：approve/reject/hide/remove/resolveReport，成功后失效待审队列 + 已审核缓存。 */
export function useGalleryModeration(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();

  // 状态迁移会跨 tab（如 approve 把作品从待审移到已审），因此统一失效整个 galleryAdmin 根。
  const invalidatePending = () =>
    queryClient.invalidateQueries({
      queryKey: galleryAdminQueryKeys.root(),
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
