import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import {
  membershipAdminActions,
  type AdminMembershipGrantInput,
  type AdminMembershipOrderParams,
  type AdminMembershipPointsParams,
  type AdminMembershipUsersParams,
  type AdminOrderFulfillInput,
  type AdminOrderRefundInput,
  type AdminPointsGrantInput,
  type AdminUserPointsDetailParams,
} from './membership-admin.actions';

type MutationCallbacks = {
  onSuccess?: () => void | Promise<void>;
  onError?: (error: unknown) => void;
};

export const membershipAdminQueryKeys = {
  levels: () => ['membershipAdmin', 'levels'] as const,
  packages: () => ['membershipAdmin', 'packages'] as const,
  pricingRules: () => ['membershipAdmin', 'pricing-rules'] as const,
  ordersRoot: () => ['membershipAdmin', 'orders'] as const,
  orders: (params: AdminMembershipOrderParams) =>
    [
      'membershipAdmin',
      'orders',
      params.page ?? 1,
      params.pageSize ?? 15,
      params.userId ?? '',
      params.status ?? '',
      params.orderType ?? '',
    ] as const,
  pointsRecordsRoot: () => ['membershipAdmin', 'points-records'] as const,
  pointsRecords: (params: AdminMembershipPointsParams) =>
    [
      'membershipAdmin',
      'points-records',
      params.page ?? 1,
      params.pageSize ?? 15,
      params.userId ?? '',
      params.source ?? '',
    ] as const,
  usersRoot: () => ['membershipAdmin', 'users'] as const,
  users: (params: AdminMembershipUsersParams) =>
    [
      'membershipAdmin',
      'users',
      params.page ?? 1,
      params.pageSize ?? 20,
      params.search ?? '',
    ] as const,
  userDetail: (userId: string) => ['membershipAdmin', 'users', userId] as const,
  userPointsDetail: (userId: string, params?: AdminUserPointsDetailParams) =>
    [
      'membershipAdmin',
      'users',
      userId,
      'points-detail',
      params?.grantTake ?? '',
      params?.holdTake ?? '',
      params?.recordTake ?? '',
    ] as const,
};

function callOnSuccess(callbacks?: MutationCallbacks) {
  return callbacks?.onSuccess?.();
}

function callOnError(error: unknown, callbacks?: MutationCallbacks) {
  return callbacks?.onError?.(error);
}

function invalidateLevels(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: membershipAdminQueryKeys.levels(),
  });
}

function invalidatePackages(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: membershipAdminQueryKeys.packages(),
  });
}

function invalidatePricingRules(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: membershipAdminQueryKeys.pricingRules(),
  });
}

function invalidateOrders(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: membershipAdminQueryKeys.ordersRoot(),
  });
}

function invalidatePointsRecords(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: membershipAdminQueryKeys.pointsRecordsRoot(),
  });
}

function invalidateUsers(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: membershipAdminQueryKeys.usersRoot(),
  });
}

function invalidateUser(queryClient: QueryClient, userId: string) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: membershipAdminQueryKeys.userDetail(userId),
    }),
    queryClient.invalidateQueries({
      queryKey: ['membershipAdmin', 'users', userId, 'points-detail'],
    }),
    invalidateUsers(queryClient),
  ]);
}

export function useAdminMembershipLevelsQuery() {
  return useQuery({
    queryKey: membershipAdminQueryKeys.levels(),
    queryFn: membershipAdminActions.listLevels,
  });
}

export function useCreateAdminMembershipLevelMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: membershipAdminActions.createLevel,
    onSuccess: async () => {
      await invalidateLevels(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useUpdateAdminMembershipLevelMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      membershipAdminActions.updateLevel(id, data),
    onSuccess: async () => {
      await invalidateLevels(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useCreateAdminMembershipPlanMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: membershipAdminActions.createPlan,
    onSuccess: async () => {
      await invalidateLevels(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useUpdateAdminMembershipPlanMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      membershipAdminActions.updatePlan(id, data),
    onSuccess: async () => {
      await invalidateLevels(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useAdminPointsPackagesQuery() {
  return useQuery({
    queryKey: membershipAdminQueryKeys.packages(),
    queryFn: membershipAdminActions.listPackages,
  });
}

export function useCreateAdminPointsPackageMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: membershipAdminActions.createPackage,
    onSuccess: async () => {
      await invalidatePackages(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useUpdateAdminPointsPackageMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      membershipAdminActions.updatePackage(id, data),
    onSuccess: async () => {
      await invalidatePackages(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useAdminPricingRulesQuery() {
  return useQuery({
    queryKey: membershipAdminQueryKeys.pricingRules(),
    queryFn: membershipAdminActions.listPricingRules,
  });
}

export function useCreateAdminPricingRuleMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: membershipAdminActions.createPricingRule,
    onSuccess: async () => {
      await invalidatePricingRules(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useUpdateAdminPricingRuleMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      membershipAdminActions.updatePricingRule(id, data),
    onSuccess: async () => {
      await invalidatePricingRules(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function usePreviewAdminPricingRuleMutation(callbacks?: MutationCallbacks) {
  return useMutation({
    mutationFn: membershipAdminActions.previewPricingRule,
    onSuccess: () => callOnSuccess(callbacks),
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useAdminMembershipOrdersQuery(params: AdminMembershipOrderParams) {
  return useQuery({
    queryKey: membershipAdminQueryKeys.orders(params),
    queryFn: () => membershipAdminActions.listOrders(params),
  });
}

export function useFulfillAdminMembershipOrderMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AdminOrderFulfillInput) =>
      membershipAdminActions.fulfillOrder(data),
    onSuccess: async () => {
      await invalidateOrders(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useRefundAdminMembershipOrderMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AdminOrderRefundInput) =>
      membershipAdminActions.refundOrder(data),
    onSuccess: async () => {
      await Promise.all([
        invalidateOrders(queryClient),
        invalidatePointsRecords(queryClient),
      ]);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useAdminPointsRecordsQuery(params: AdminMembershipPointsParams) {
  return useQuery({
    queryKey: membershipAdminQueryKeys.pointsRecords(params),
    queryFn: () => membershipAdminActions.listPointsRecords(params),
  });
}

export function useAdminMembershipUsersQuery(params: AdminMembershipUsersParams) {
  return useQuery({
    queryKey: membershipAdminQueryKeys.users(params),
    queryFn: () => membershipAdminActions.listUsers(params),
  });
}

export function useAdminMembershipUserDetailQuery(userId: string, enabled = true) {
  return useQuery({
    queryKey: membershipAdminQueryKeys.userDetail(userId),
    queryFn: () => membershipAdminActions.getUserDetail(userId),
    enabled: enabled && Boolean(userId),
  });
}

export function useAdminUserPointsDetailQuery(
  userId: string,
  params?: AdminUserPointsDetailParams,
  enabled = true,
) {
  return useQuery({
    queryKey: membershipAdminQueryKeys.userPointsDetail(userId, params),
    queryFn: () => membershipAdminActions.getUserPointsDetail(userId, params),
    enabled: enabled && Boolean(userId),
  });
}

export function useApproveAdminMembershipUserMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, note }: { userId: string; note?: string }) =>
      membershipAdminActions.approveUser(userId, { note }),
    onSuccess: async (_data, variables) => {
      await invalidateUser(queryClient, variables.userId);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useGrantAdminMembershipMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AdminMembershipGrantInput) =>
      membershipAdminActions.grantMembership(data),
    onSuccess: async (_data, variables) => {
      await invalidateUser(queryClient, variables.userId);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useGrantAdminPointsMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AdminPointsGrantInput) =>
      membershipAdminActions.grantPoints(data),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        invalidateUser(queryClient, variables.userId),
        invalidatePointsRecords(queryClient),
      ]);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}
