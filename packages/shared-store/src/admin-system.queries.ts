import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import {
  adminSystemActions,
  type AdminSystemModelInput,
  type AdminSystemPromptInput,
  type AdminSystemSettingValues,
} from './admin-system.actions';

type MutationCallbacks = {
  onSuccess?: () => void | Promise<void>;
  onError?: (error: unknown) => void;
};

export const adminSystemQueryKeys = {
  settings: () => ['adminSystem', 'settings'] as const,
  models: () => ['adminSystem', 'models'] as const,
  membershipLevels: () => ['adminSystem', 'membership-levels'] as const,
  prompts: () => ['adminSystem', 'prompts'] as const,
};

function callOnSuccess(callbacks?: MutationCallbacks) {
  return callbacks?.onSuccess?.();
}

function callOnError(error: unknown, callbacks?: MutationCallbacks) {
  return callbacks?.onError?.(error);
}

function invalidateSettings(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: adminSystemQueryKeys.settings(),
  });
}

function invalidateModels(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: adminSystemQueryKeys.models(),
  });
}

function invalidatePrompts(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: adminSystemQueryKeys.prompts(),
  });
}

export function useAdminSystemSettingsQuery(enabled = true) {
  return useQuery({
    queryKey: adminSystemQueryKeys.settings(),
    queryFn: adminSystemActions.listSettings,
    enabled,
  });
}

export function useUpdateAdminSystemSettingsMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: AdminSystemSettingValues) =>
      adminSystemActions.updateSettings(values),
    onSuccess: async () => {
      await invalidateSettings(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useAdminSystemModelsQuery(enabled = true) {
  return useQuery({
    queryKey: adminSystemQueryKeys.models(),
    queryFn: adminSystemActions.listModels,
    enabled,
  });
}

export function useAdminSystemMembershipLevelsQuery(enabled = true) {
  return useQuery({
    queryKey: adminSystemQueryKeys.membershipLevels(),
    queryFn: adminSystemActions.listMembershipLevels,
    enabled,
  });
}

export function useCreateAdminSystemModelMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AdminSystemModelInput) =>
      adminSystemActions.createModel(data),
    onSuccess: async () => {
      await invalidateModels(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useUpdateAdminSystemModelMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AdminSystemModelInput }) =>
      adminSystemActions.updateModel(id, data),
    onSuccess: async () => {
      await invalidateModels(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useDeleteAdminSystemModelMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminSystemActions.deleteModel,
    onSuccess: async () => {
      await invalidateModels(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useAdminSystemPromptsQuery(enabled = true) {
  return useQuery({
    queryKey: adminSystemQueryKeys.prompts(),
    queryFn: adminSystemActions.listPrompts,
    enabled,
  });
}

export function useCreateAdminSystemPromptMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AdminSystemPromptInput) =>
      adminSystemActions.createPrompt(data),
    onSuccess: async () => {
      await invalidatePrompts(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useUpdateAdminSystemPromptMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AdminSystemPromptInput }) =>
      adminSystemActions.updatePrompt(id, data),
    onSuccess: async () => {
      await invalidatePrompts(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function usePublishAdminSystemPromptMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminSystemActions.publishPrompt,
    onSuccess: async () => {
      await invalidatePrompts(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}
