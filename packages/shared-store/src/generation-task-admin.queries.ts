import { useQuery } from '@tanstack/react-query';
import {
  generationTaskAdminActions,
  type GenerationTaskAdminListParams,
} from './generation-task-admin.actions';

export const generationTaskAdminQueryKeys = {
  root: () => ['generationTaskAdmin'] as const,
  list: (params: GenerationTaskAdminListParams) => ['generationTaskAdmin', 'list', params] as const,
  detail: (id: string) => ['generationTaskAdmin', 'detail', id] as const,
};

export function useGenerationTaskAdminList(params: GenerationTaskAdminListParams) {
  return useQuery({
    queryKey: generationTaskAdminQueryKeys.list(params),
    queryFn: () => generationTaskAdminActions.list(params),
    // 翻页时保留上一页数据，避免表格闪空。
    placeholderData: (prev) => prev,
  });
}

/** 详情只在抽屉打开时才请求（照 risk-admin.queries.ts 的既有写法）。 */
export function useGenerationTaskAdminDetail(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: generationTaskAdminQueryKeys.detail(id ?? ''),
    queryFn: () => generationTaskAdminActions.detail(id as string),
    enabled: enabled && Boolean(id),
  });
}
