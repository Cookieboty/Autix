import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  membershipUserActions,
  type CreateMembershipOrderInput,
  type MembershipInfo,
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
  ordersRoot: () => ['membership', 'orders'] as const,
  orders: (params?: { page?: number }) =>
    [...membershipUserQueryKeys.ordersRoot(), params?.page ?? 1] as const,
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
