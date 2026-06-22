import { useCallback, useState } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import {
  membershipAdminActions,
  type AdminAuditEntry,
  type AdminAuditLogParams,
  type AdminCampaignGrantOnceInput,
  type AdminCampaignMutationInput,
  type AdminCampaignRewardsParams,
  type AdminMembershipGrantInput,
  type AdminMembershipOrderParams,
  type AdminMembershipPointsParams,
  type AdminMembershipUsersParams,
  type AdminOrderFulfillInput,
  type AdminOrderRefundInput,
  type AdminPointsGrantInput,
  type AdminUserPointsDetailParams,
  type Order,
  type UpsertCampaignInput,
} from './membership-admin.actions';

type MutationCallbacks = {
  onSuccess?: () => void | Promise<void>;
  onError?: (error: unknown) => void;
};

export const membershipAdminQueryKeys = {
  root: () => ['membershipAdmin'] as const,
  auditLogsRoot: () => ['membershipAdmin', 'audit-logs'] as const,
  auditLogs: (params: AdminAuditLogParams) =>
    [
      'membershipAdmin',
      'audit-logs',
      params.action ?? '',
      params.actorId ?? '',
      params.limit ?? '',
      params.cursor ?? '',
    ] as const,
  levels: () => ['membershipAdmin', 'levels'] as const,
  packages: () => ['membershipAdmin', 'packages'] as const,
  pricingRules: () => ['membershipAdmin', 'pricing-rules'] as const,
  campaigns: () => ['membershipAdmin', 'campaigns'] as const,
  campaignRewardsRoot: (campaignId: string) =>
    ['membershipAdmin', 'campaigns', campaignId, 'rewards'] as const,
  campaignRewards: (
    campaignId: string,
    params?: AdminCampaignRewardsParams,
  ) =>
    [
      ...membershipAdminQueryKeys.campaignRewardsRoot(campaignId),
      params?.take ?? '',
    ] as const,
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
  userRoot: (userId: string) =>
    [...membershipAdminQueryKeys.usersRoot(), userId] as const,
  users: (params: AdminMembershipUsersParams) =>
    [
      'membershipAdmin',
      'users',
      params.page ?? 1,
      params.pageSize ?? 20,
      params.search ?? '',
    ] as const,
  userDetail: (userId: string) => membershipAdminQueryKeys.userRoot(userId),
  userPointsDetailRoot: (userId: string) =>
    [...membershipAdminQueryKeys.userRoot(userId), 'points-detail'] as const,
  userPointsDetail: (userId: string, params?: AdminUserPointsDetailParams) =>
    [
      ...membershipAdminQueryKeys.userPointsDetailRoot(userId),
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

function invalidateCampaigns(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: membershipAdminQueryKeys.campaigns(),
  });
}

function invalidateCampaignRewards(
  queryClient: QueryClient,
  campaignId: string,
) {
  return queryClient.invalidateQueries({
    queryKey: membershipAdminQueryKeys.campaignRewardsRoot(campaignId),
  });
}

function invalidateUser(queryClient: QueryClient, userId: string) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: membershipAdminQueryKeys.userDetail(userId),
    }),
    queryClient.invalidateQueries({
      queryKey: membershipAdminQueryKeys.userPointsDetailRoot(userId),
    }),
    invalidateUsers(queryClient),
  ]);
}

function readCachedOrders(data: unknown): Order[] {
  if (Array.isArray(data)) return data as Order[];
  if (
    data &&
    typeof data === 'object' &&
    'items' in data &&
    Array.isArray(data.items)
  ) {
    return data.items as Order[];
  }
  return [];
}

function findCachedOrderUserId(queryClient: QueryClient, orderId: string) {
  const ordersQueries = queryClient.getQueriesData({
    queryKey: membershipAdminQueryKeys.ordersRoot(),
  });

  for (const [, data] of ordersQueries) {
    const order = readCachedOrders(data).find((item) => item.id === orderId);
    if (order?.userId) return order.userId;
  }

  return undefined;
}

function invalidateUserScopedMembership(
  queryClient: QueryClient,
  userId?: string,
) {
  return Promise.all([
    invalidateOrders(queryClient),
    invalidatePointsRecords(queryClient),
    userId ? invalidateUser(queryClient, userId) : invalidateUsers(queryClient),
  ]);
}

function extractErrorMessage(error: unknown, fallback: string) {
  const responseData = (error as {
    response?: { data?: { message?: unknown; msg?: unknown } };
  }).response?.data;
  const responseMessage = responseData?.message ?? responseData?.msg;
  if (typeof responseMessage === 'string') return responseMessage;

  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : fallback;
}

export function useAdminAuditLogsQuery(params: AdminAuditLogParams) {
  return useQuery({
    queryKey: membershipAdminQueryKeys.auditLogs(params),
    queryFn: () => membershipAdminActions.listAuditLogs(params),
  });
}

export function useAdminAuditLogsController({
  loadFailedMessage,
  pageSize = 50,
}: {
  loadFailedMessage: string;
  pageSize?: number;
}) {
  const [items, setItems] = useState<AdminAuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(
    async ({
      action,
      actorId,
      append,
      cursor,
    }: {
      action?: string;
      actorId?: string;
      append: boolean;
      cursor: number | null;
    }) => {
      setLoading(true);
      setError(null);
      try {
        const data = await membershipAdminActions.listAuditLogs({
          action: action || undefined,
          actorId: actorId || undefined,
          limit: pageSize,
          cursor: cursor ?? undefined,
        });
        setItems((prev) => (append ? [...prev, ...data.items] : data.items));
        setTotal(data.total ?? 0);
        setNextCursor(data.nextCursor ?? null);
      } catch (loadError) {
        setError(extractErrorMessage(loadError, loadFailedMessage));
      } finally {
        setLoading(false);
      }
    },
    [loadFailedMessage, pageSize],
  );

  return {
    items,
    total,
    nextCursor,
    loading,
    error,
    loadPage,
  };
}

export function useAdminCampaignsQuery() {
  return useQuery({
    queryKey: membershipAdminQueryKeys.campaigns(),
    queryFn: membershipAdminActions.listCampaigns,
  });
}

export function useAdminCampaignRewardsQuery(
  campaignId: string,
  params?: AdminCampaignRewardsParams,
  enabled = true,
) {
  return useQuery({
    queryKey: membershipAdminQueryKeys.campaignRewards(campaignId, params),
    queryFn: () => membershipAdminActions.listCampaignRewards(campaignId, params),
    enabled: enabled && Boolean(campaignId),
  });
}

export function useCreateAdminCampaignMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertCampaignInput) =>
      membershipAdminActions.createCampaign(data),
    onSuccess: async () => {
      await invalidateCampaigns(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useUpdateAdminCampaignMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AdminCampaignMutationInput) =>
      membershipAdminActions.updateCampaign(data),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        invalidateCampaigns(queryClient),
        invalidateCampaignRewards(queryClient, variables.id),
      ]);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useGrantAdminCampaignOnceMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AdminCampaignGrantOnceInput) =>
      membershipAdminActions.grantCampaignOnce(data),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        invalidateCampaigns(queryClient),
        invalidateCampaignRewards(queryClient, variables.campaignId),
      ]);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
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

export function useDeleteAdminMembershipLevelMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: membershipAdminActions.deleteLevel,
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

export function useDeleteAdminMembershipPlanMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: membershipAdminActions.deletePlan,
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
    onSuccess: async (_data, variables) => {
      await invalidateUserScopedMembership(
        queryClient,
        variables.userId ?? findCachedOrderUserId(queryClient, variables.id),
      );
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
    onSuccess: async (_data, variables) => {
      await invalidateUserScopedMembership(
        queryClient,
        variables.userId ?? findCachedOrderUserId(queryClient, variables.id),
      );
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
      await invalidateUserScopedMembership(queryClient, variables.userId);
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
      await invalidateUserScopedMembership(queryClient, variables.userId);
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
      await invalidateUserScopedMembership(queryClient, variables.userId);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}
