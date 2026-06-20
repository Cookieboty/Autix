import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  membershipUserActions,
  type CreateMembershipOrderInput,
  type MembershipInfo,
  type MembershipOrderParams,
  type MembershipPointsRecordParams,
  type PointsBalance,
} from './membership-user.actions';

export type { MembershipInfo, PointsBalance };

type MutationCallbacks = {
  onSuccess?: () => void | Promise<void>;
  onError?: (error: unknown) => void;
};

export const membershipUserQueryKeys = {
  root: () => ['membership'] as const,
  levels: () => ['membership', 'levels'] as const,
  me: () => ['membership', 'me'] as const,
  pointsBalance: () => ['membership', 'points-balance'] as const,
  pointsPackages: () => ['membership', 'points-packages'] as const,
  pointsSummary: () => ['membership', 'points-summary'] as const,
  pointsRecordsRoot: () => ['membership', 'points-records'] as const,
  pointsRecords: (params?: MembershipPointsRecordParams) =>
    [
      ...membershipUserQueryKeys.pointsRecordsRoot(),
      params?.page ?? 1,
      params?.pageSize ?? 20,
      params?.source ?? '',
    ] as const,
  ordersRoot: () => ['membership', 'orders'] as const,
  orders: (params?: MembershipOrderParams) =>
    [
      ...membershipUserQueryKeys.ordersRoot(),
      params?.page ?? 1,
      params?.pageSize ?? 20,
      params?.status ?? '',
      params?.orderType ?? '',
    ] as const,
};

export function useMembershipLevelsQuery() {
  return useQuery({
    queryKey: membershipUserQueryKeys.levels(),
    queryFn: membershipUserActions.listLevels,
  });
}

export function useMyMembershipQuery(enabled = true) {
  return useQuery({
    queryKey: membershipUserQueryKeys.me(),
    queryFn: membershipUserActions.getMe,
    enabled,
  });
}

export function useCancelMembershipMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: membershipUserActions.cancelAtPeriodEnd,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: membershipUserQueryKeys.me() });
      await callbacks?.onSuccess?.();
    },
    onError: (error) => callbacks?.onError?.(error),
  });
}

export function usePointsBalanceQuery(enabled = true) {
  return useQuery({
    queryKey: membershipUserQueryKeys.pointsBalance(),
    queryFn: membershipUserActions.getPointsBalance,
    enabled,
  });
}

export function usePointsPackagesQuery() {
  return useQuery({
    queryKey: membershipUserQueryKeys.pointsPackages(),
    queryFn: membershipUserActions.listPointsPackages,
  });
}

export function usePointsSummaryQuery(enabled = true) {
  return useQuery({
    queryKey: membershipUserQueryKeys.pointsSummary(),
    queryFn: membershipUserActions.getPointsSummary,
    enabled,
  });
}

export function useMembershipPointsRecordsQuery(
  params: MembershipPointsRecordParams = {},
) {
  return useQuery({
    queryKey: membershipUserQueryKeys.pointsRecords(params),
    queryFn: () => membershipUserActions.listPointsRecords(params),
  });
}

export function useMembershipOrdersQuery(params: MembershipOrderParams = {}) {
  return useQuery({
    queryKey: membershipUserQueryKeys.orders(params),
    queryFn: () => membershipUserActions.listOrders(params),
  });
}

export function useCancelOrderMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: membershipUserActions.cancelOrder,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: membershipUserQueryKeys.ordersRoot(),
      });
      await callbacks?.onSuccess?.();
    },
    onError: (error) => callbacks?.onError?.(error),
  });
}

export function useCreateOrderMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMembershipOrderInput) =>
      membershipUserActions.createStripeCheckout(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: membershipUserQueryKeys.ordersRoot(),
      });
      await callbacks?.onSuccess?.();
    },
    onError: (error) => callbacks?.onError?.(error),
  });
}

export function useCreateOrderCheckoutMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: membershipUserActions.createStripeCheckoutForOrder,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: membershipUserQueryKeys.ordersRoot(),
      });
      await callbacks?.onSuccess?.();
    },
    onError: (error) => callbacks?.onError?.(error),
  });
}
