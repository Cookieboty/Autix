import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import {
  pricingAdminActions,
  type AdminModelDescription,
  type AdminModelSchemas,
  type CreateTaskModelBindingInput,
  type CreateDiscountInput,
  type DryRunPricingInput,
  type DryRunResult,
  type PricingDiscount,
  type TaskModelBinding,
  type UpdateDiscountInput,
  type UpdateModelDescriptionInput,
  type UpdateModelSchemasInput,
  type UpdateTaskModelBindingInput,
} from './pricing-admin.actions';

type MutationCallbacks = {
  onSuccess?: () => void | Promise<void>;
  onError?: (error: unknown) => void;
};

export const pricingAdminQueryKeys = {
  root: () => ['pricingAdmin'] as const,
  model: (id: string) => ['pricingAdmin', 'model', id] as const,
  taskDefinitions: () => ['pricingAdmin', 'task-definitions'] as const,
  taskModelBindingsRoot: () => ['pricingAdmin', 'task-model-bindings'] as const,
  taskModelBindings: (taskType?: string) =>
    [...pricingAdminQueryKeys.taskModelBindingsRoot(), taskType ?? ''] as const,
  discounts: () => ['pricingAdmin', 'discounts'] as const,
};

function callOnSuccess(callbacks?: MutationCallbacks) {
  return callbacks?.onSuccess?.();
}

function callOnError(error: unknown, callbacks?: MutationCallbacks) {
  return callbacks?.onError?.(error);
}

function invalidateModel(queryClient: QueryClient, id: string) {
  return queryClient.invalidateQueries({
    queryKey: pricingAdminQueryKeys.model(id),
  });
}

function invalidateTaskModelBindings(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: pricingAdminQueryKeys.taskModelBindingsRoot(),
  });
}

function invalidateDiscounts(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: pricingAdminQueryKeys.discounts(),
  });
}

// -- models --

export function useAdminModelQuery(id: string, enabled = true) {
  return useQuery({
    queryKey: pricingAdminQueryKeys.model(id),
    queryFn: () => pricingAdminActions.getModel(id),
    enabled: enabled && Boolean(id),
  });
}

export function useSaveAdminModelSchemasMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateModelSchemasInput }): Promise<AdminModelSchemas> =>
      pricingAdminActions.updateModelSchemas(id, data),
    onSuccess: async (_data, variables) => {
      await invalidateModel(queryClient, variables.id);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useSaveAdminModelDescriptionMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateModelDescriptionInput;
    }): Promise<AdminModelDescription> => pricingAdminActions.updateModelDescription(id, data),
    onSuccess: async (_data, variables) => {
      await invalidateModel(queryClient, variables.id);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useDryRunAdminPricingMutation(callbacks?: MutationCallbacks) {
  return useMutation({
    mutationFn: (data: DryRunPricingInput): Promise<DryRunResult> =>
      pricingAdminActions.dryRunPricing(data),
    onSuccess: () => callOnSuccess(callbacks),
    onError: (error) => callOnError(error, callbacks),
  });
}

// -- task-model bindings --

export function useAdminTaskDefinitionsQuery() {
  return useQuery({
    queryKey: pricingAdminQueryKeys.taskDefinitions(),
    queryFn: pricingAdminActions.listTaskDefinitions,
  });
}

export function useAdminTaskModelBindingsQuery(taskType?: string) {
  return useQuery({
    queryKey: pricingAdminQueryKeys.taskModelBindings(taskType),
    queryFn: () => pricingAdminActions.listTaskModelBindings(taskType),
  });
}

export function useCreateAdminTaskModelBindingMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTaskModelBindingInput): Promise<TaskModelBinding> =>
      pricingAdminActions.createTaskModelBinding(data),
    onSuccess: async () => {
      await invalidateTaskModelBindings(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useUpdateAdminTaskModelBindingMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskType,
      modelConfigId,
      data,
    }: {
      taskType: string;
      modelConfigId: string;
      data: UpdateTaskModelBindingInput;
    }): Promise<TaskModelBinding> =>
      pricingAdminActions.updateTaskModelBinding(taskType, modelConfigId, data),
    onSuccess: async () => {
      await invalidateTaskModelBindings(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

// -- discounts --

export function useAdminDiscountsQuery() {
  return useQuery({
    queryKey: pricingAdminQueryKeys.discounts(),
    queryFn: pricingAdminActions.listDiscounts,
  });
}

export function useCreateAdminDiscountMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDiscountInput): Promise<PricingDiscount> =>
      pricingAdminActions.createDiscount(data),
    onSuccess: async () => {
      await invalidateDiscounts(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useUpdateAdminDiscountMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDiscountInput }): Promise<PricingDiscount> =>
      pricingAdminActions.updateDiscount(id, data),
    onSuccess: async () => {
      await invalidateDiscounts(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useDeleteAdminDiscountMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string): Promise<PricingDiscount> => pricingAdminActions.deleteDiscount(id),
    onSuccess: async () => {
      await invalidateDiscounts(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}
