import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { galleryAdminActions } from './gallery-admin.actions';
import type { GalleryAdminListParams } from './gallery-admin.actions';

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

/** JSON 批量导入广场作品，成功后失效待审/已审整个 galleryAdmin 缓存根。 */
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

export function useDownloadGalleryImportTemplateMutation() {
  return useMutation({
    mutationFn: () => galleryAdminActions.getGalleryImportTemplate(),
  });
}

/** 复用通用 batch-job 轮询 action，供 TemplateImportDialog 的 pollJob 直接使用。 */
export function useGalleryBatchJobPoller() {
  return galleryAdminActions.getBatchJob;
}
