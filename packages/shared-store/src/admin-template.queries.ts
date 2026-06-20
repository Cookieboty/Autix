import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import {
  adminTemplateActions,
  type AdminTemplateBatchDeleteInput,
  type AdminTemplateBatchReviewInput,
  type AdminTemplateExportParams,
  type AdminTemplateHotInput,
  type AdminTemplateListParams,
  type AdminTemplateResourceType,
  type AdminTemplateReviewInput,
} from './admin-template.actions';

type MutationCallbacks = {
  onSuccess?: () => void | Promise<void>;
  onError?: (error: unknown) => void;
};

export const adminTemplateQueryKeys = {
  root: () => ['adminTemplate'] as const,
  listsRoot: () => ['adminTemplate', 'list'] as const,
  list: (params: AdminTemplateListParams) =>
    [
      'adminTemplate',
      'list',
      params.resourceType ?? 'image-templates',
      params.status ?? '',
      params.page ?? 1,
      params.pageSize ?? 15,
    ] as const,
};

function callOnSuccess(callbacks?: MutationCallbacks) {
  return callbacks?.onSuccess?.();
}

function callOnError(error: unknown, callbacks?: MutationCallbacks) {
  return callbacks?.onError?.(error);
}

function invalidateTemplateLists(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: adminTemplateQueryKeys.listsRoot(),
  });
}

export function useAdminTemplatesQuery(params: AdminTemplateListParams) {
  return useQuery({
    queryKey: adminTemplateQueryKeys.list(params),
    queryFn: () => adminTemplateActions.list(params),
  });
}

export function useReviewAdminTemplateMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminTemplateReviewInput) => adminTemplateActions.review(input),
    onSuccess: async () => {
      await invalidateTemplateLists(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useBatchReviewAdminTemplatesMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminTemplateBatchReviewInput) =>
      adminTemplateActions.batchReview(input),
    onSuccess: async () => {
      await invalidateTemplateLists(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useBatchDeleteAdminTemplatesMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminTemplateBatchDeleteInput) =>
      adminTemplateActions.batchDelete(input),
    onSuccess: async () => {
      await invalidateTemplateLists(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useSetAdminTemplateHotMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminTemplateHotInput) => adminTemplateActions.setHot(input),
    onSuccess: async () => {
      await invalidateTemplateLists(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useImportAdminTemplatesMutation(
  resourceType: AdminTemplateResourceType,
  callbacks?: MutationCallbacks,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: Record<string, any>[]) =>
      adminTemplateActions.importTemplates(resourceType, items),
    onSuccess: async () => {
      await invalidateTemplateLists(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useAdminTemplateImportTemplateQuery(
  resourceType: AdminTemplateResourceType,
  enabled = true,
) {
  return useQuery({
    queryKey: ['adminTemplate', 'import-template', resourceType] as const,
    queryFn: () => adminTemplateActions.importTemplate(resourceType),
    enabled,
  });
}

export function useDownloadAdminTemplateImportTemplateMutation() {
  return useMutation({
    mutationFn: (resourceType: AdminTemplateResourceType) =>
      adminTemplateActions.importTemplate(resourceType),
  });
}

export function useExportAdminTemplatesMutation() {
  return useMutation({
    mutationFn: (params: AdminTemplateExportParams) =>
      adminTemplateActions.exportTemplates(params),
  });
}

export function useAdminTemplateBatchJobPoller() {
  return adminTemplateActions.getBatchJob;
}
