import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { galleryAdminActions } from './gallery-admin.actions';
import type { GalleryAdminListParams } from './gallery-admin.actions';
import type { GalleryBatchAction } from './gallery-admin.actions';

type MutationCallbacks = {
  onSuccess?: () => void | Promise<void>;
  onError?: (error: unknown) => void;
};

export const galleryAdminQueryKeys = {
  root: () => ['galleryAdmin'] as const,
  list: (params: GalleryAdminListParams) =>
    ['galleryAdmin', 'list', params] as const,
  categories: () => ['galleryAdmin', 'categories'] as const,
};

function callOnSuccess(callbacks?: MutationCallbacks) {
  return callbacks?.onSuccess?.();
}

function callOnError(error: unknown, callbacks?: MutationCallbacks) {
  return callbacks?.onError?.(error);
}

/** 管理端广场列表：页码分页 + 筛选。切页/改筛选 → 传入不同 params，React Query 自动按 key 缓存。 */
export function useGalleryAdminList(params: GalleryAdminListParams) {
  return useQuery({
    queryKey: galleryAdminQueryKeys.list(params),
    queryFn: () => galleryAdminActions.list(params),
    placeholderData: (prev) => prev,
  });
}

/** 分类下拉数据（去重的现存 category）。 */
export function useGalleryCategories() {
  return useQuery({
    queryKey: galleryAdminQueryKeys.categories(),
    queryFn: () => galleryAdminActions.listCategories(),
    staleTime: 5 * 60_000,
  });
}

/** 广场审核操作集合：approve/reject/hide/remove/resolveReport，成功后失效待审队列 + 已审核缓存。 */
export function useGalleryModeration(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();

  // 按 id 追踪在飞的请求：只灰掉被点的那一行，而不是整张表。
  // 用 Set 而不是 mutation.variables —— variables 只保留最后一次调用的值，
  // 连点两行时前一行会被误判成已完成。
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());

  const addPending = useCallback((ids: string[]) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  const clearPending = useCallback((ids: string[]) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  /**
   * 状态迁移会跨 tab（如 approve 把作品从待审移到已审），因此统一失效整个 galleryAdmin 根。
   * 刻意不 await：失效只是让列表自己重新拉一遍，isFetching 已经在表达"正在刷新"。
   * 一旦 await，mutation 的 isPending 会被拖到整个 refetch 结束才翻假，
   * 按钮就会在请求早已成功之后继续锁住一整个往返（远程库 ~347ms 起，refetch 失败重试更久）。
   */
  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: galleryAdminQueryKeys.root() });
  };

  const approve = useMutation({
    mutationFn: (id: string) => galleryAdminActions.approve(id),
    onMutate: (id) => {
      addPending([id]);
    },
    onSuccess: () => {
      invalidateAll();
      void callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
    onSettled: (_data, _error, id) => clearPending([id]),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      galleryAdminActions.reject(id, reason),
    onMutate: ({ id }) => {
      addPending([id]);
    },
    onSuccess: () => {
      invalidateAll();
      void callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
    onSettled: (_data, _error, { id }) => clearPending([id]),
  });

  const hide = useMutation({
    mutationFn: (id: string) => galleryAdminActions.hide(id),
    onMutate: (id) => {
      addPending([id]);
    },
    onSuccess: () => {
      invalidateAll();
      void callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
    onSettled: (_data, _error, id) => clearPending([id]),
  });

  const remove = useMutation({
    mutationFn: (id: string) => galleryAdminActions.remove(id),
    onMutate: (id) => {
      addPending([id]);
    },
    onSuccess: () => {
      invalidateAll();
      void callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
    onSettled: (_data, _error, id) => clearPending([id]),
  });

  const resolveReport = useMutation({
    mutationFn: ({
      reportId,
      status,
    }: {
      reportId: string;
      status: 'RESOLVED' | 'DISMISSED';
    }) => galleryAdminActions.resolveReport(reportId, status),
    onSuccess: () => {
      invalidateAll();
      void callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });

  const batch = useMutation({
    mutationFn: ({
      ids,
      action,
      reason,
    }: {
      ids: string[];
      action: GalleryBatchAction;
      reason?: string;
    }) => galleryAdminActions.batch(ids, action, reason),
    onMutate: ({ ids }) => {
      addPending(ids);
    },
    onSuccess: () => {
      invalidateAll();
      void callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
    onSettled: (_data, _error, { ids }) => clearPending(ids),
  });

  return { approve, reject, hide, remove, resolveReport, batch, pendingIds };
}

/** JSON 批量导入。导入的作品落 PENDING（媒体搬运完成后由 worker 自动发布），故成功后失效整个 galleryAdmin 根。 */
export function useImportGalleryMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (items: Record<string, any>[]) => galleryAdminActions.importGallery(items),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: galleryAdminQueryKeys.root() });
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

/** 复用通用 batch-job 轮询 action，供 TemplateImportDialog 的 pollJob 直接使用。 */
export function useGalleryBatchJobPoller() {
  return galleryAdminActions.getBatchJob;
}
