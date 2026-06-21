import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getClipboard, getNavigation } from '@autix/platform';
import {
  membershipUserActions,
  type CreateMembershipOrderInput,
  type CampaignProgress,
  type InviteCode,
  type InviteRecord,
  type MembershipInfo,
  type MembershipLevel,
  type MembershipOrderParams,
  type MembershipPlan,
  type MembershipPointsRecordParams,
  type Order,
  type PointsBalance,
  type PointsPackage,
  type MembershipStripeCheckoutSyncResult,
  type UserActivityStreak,
} from './membership-user.actions';

export type {
  CampaignProgress,
  InviteCode,
  InviteRecord,
  MembershipInfo,
  MembershipLevel,
  MembershipPlan,
  Order,
  PointsBalance,
  PointsPackage,
  MembershipStripeCheckoutSyncResult,
  UserActivityStreak,
};

type MutationCallbacks = {
  onSuccess?: () => void | Promise<void>;
  onError?: (error: unknown) => void;
};

type MembershipRuntimeOptions = {
  assignUrl?: (url: string) => void;
  navigateToOrder?: (orderId: string) => void;
  getOrigin?: () => string;
  writeClipboardText?: (text: string) => void | Promise<void>;
  setTimeout?: (handler: () => void, timeout: number) => unknown;
};

export type MembershipBillingCycle = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

function openRuntimeUrl(url: string): void {
  if (typeof window !== 'undefined' && typeof window.open === 'function') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  const navigation = getNavigation();
  if (navigation.assign) {
    navigation.assign(url);
    return;
  }
  navigation.push(url);
}

function getRuntimeOrigin(): string {
  try {
    const origin = getNavigation().getOrigin?.();
    return origin ?? '';
  } catch {
    return '';
  }
}

function writeRuntimeClipboardText(text: string): void | Promise<void> {
  return getClipboard().writeText(text);
}

function setRuntimeTimeout(handler: () => void, timeout: number): unknown {
  return setTimeout(handler, timeout);
}

export const membershipUserQueryKeys = {
  root: () => ['membership'] as const,
  levels: () => ['membership', 'levels'] as const,
  me: () => ['membership', 'me'] as const,
  rewardsProgress: () => ['membership', 'rewards-progress'] as const,
  pointsBalance: () => ['membership', 'points-balance'] as const,
  pointsPackages: () => ['membership', 'points-packages'] as const,
  pointsSummary: () => ['membership', 'points-summary'] as const,
  inviteOverview: () => ['membership', 'invite-overview'] as const,
  pointsRecordsRoot: () => ['membership', 'points-records'] as const,
  pointsRecords: (params?: MembershipPointsRecordParams) =>
    [
      ...membershipUserQueryKeys.pointsRecordsRoot(),
      params?.page ?? 1,
      params?.pageSize ?? 20,
      params?.source ?? '',
    ] as const,
  ordersRoot: () => ['membership', 'orders'] as const,
  order: (id?: string) => ['membership', 'order', id ?? ''] as const,
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
    onSuccess: async (membership) => {
      queryClient.setQueryData<MembershipInfo>(
        membershipUserQueryKeys.me(),
        (current) => current ? { ...current, membership } : current,
      );
      await queryClient.invalidateQueries({ queryKey: membershipUserQueryKeys.me() });
      await callbacks?.onSuccess?.();
    },
    onError: (error) => callbacks?.onError?.(error),
  });
}

export function useMembershipRewardsProgressQuery() {
  return useQuery({
    queryKey: membershipUserQueryKeys.rewardsProgress(),
    queryFn: membershipUserActions.getRewardsProgress,
  });
}

export function useMembershipRewardsController() {
  const rewardsQuery = useMembershipRewardsProgressQuery();

  const refresh = async () => {
    await rewardsQuery.refetch();
  };

  return {
    progress: rewardsQuery.data ?? null,
    isLoading: rewardsQuery.isLoading,
    isRefreshing: rewardsQuery.isFetching,
    error: rewardsQuery.error,
    refresh,
  };
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

export function useMembershipOrderQuery(id?: string) {
  return useQuery({
    queryKey: membershipUserQueryKeys.order(id),
    queryFn: () => membershipUserActions.getOrderById(id ?? ''),
    enabled: Boolean(id),
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

export function useSyncStripeCheckoutMutation(callbacks?: {
  onSuccess?: (result: MembershipStripeCheckoutSyncResult) => void | Promise<void>;
  onError?: (error: unknown) => void;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: membershipUserActions.syncStripeCheckout,
    onSuccess: async (result) => {
      queryClient.setQueryData<Order>(
        membershipUserQueryKeys.order(result.order.id),
        result.order,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: membershipUserQueryKeys.ordersRoot() }),
        queryClient.invalidateQueries({ queryKey: membershipUserQueryKeys.order(result.order.id) }),
        queryClient.invalidateQueries({ queryKey: membershipUserQueryKeys.me() }),
        queryClient.invalidateQueries({ queryKey: membershipUserQueryKeys.pointsBalance() }),
        queryClient.invalidateQueries({ queryKey: membershipUserQueryKeys.pointsSummary() }),
      ]);
      await callbacks?.onSuccess?.(result);
    },
    onError: (error) => callbacks?.onError?.(error),
  });
}

function isActiveMembership(membership: MembershipInfo['membership'] | undefined | null) {
  return Boolean(
    membership &&
    membership.status === 'ACTIVE' &&
    new Date(membership.expiresAt) > new Date(),
  );
}

function hasPaidMembership(membership: MembershipInfo['membership'] | undefined | null) {
  return Boolean(isActiveMembership(membership) && Number(membership?.level?.level ?? 0) > 0);
}

export function useMembershipPackagesController(options: {
  requirePaidLevel?: boolean;
  onCheckoutFallback?: () => void;
} & Pick<MembershipRuntimeOptions, 'assignUrl' | 'navigateToOrder'> = {}) {
  const packagesQuery = usePointsPackagesQuery();
  const membershipQuery = useMyMembershipQuery();
  const checkoutMutation = useCreateOrderMutation();

  const membership = membershipQuery.data?.membership ?? null;
  const isMember = options.requirePaidLevel
    ? hasPaidMembership(membership)
    : isActiveMembership(membership);

  const purchasePackage = async (id: string) => {
    const checkout = await checkoutMutation.mutateAsync({
      orderType: 'POINTS_PACKAGE',
      productId: id,
    });
    if (checkout.checkoutUrl) {
      (options.assignUrl ?? openRuntimeUrl)(checkout.checkoutUrl);
      options.navigateToOrder?.(checkout.order.id);
      return;
    }
    options.onCheckoutFallback?.();
  };

  return {
    packages: packagesQuery.data ?? [],
    isLoading: packagesQuery.isLoading || membershipQuery.isLoading,
    isMember,
    purchasingId: checkoutMutation.isPending
      ? checkoutMutation.variables?.productId ?? null
      : null,
    purchasePackage,
  };
}

export function useMembershipUpgradeController(options: {
  onCheckoutFallback?: () => void;
} & Pick<MembershipRuntimeOptions, 'assignUrl' | 'navigateToOrder'> = {}) {
  const [cycle, setCycle] = useState<MembershipBillingCycle>('MONTHLY');
  const [autoRenew, setAutoRenew] = useState(true);

  const levelsQuery = useMembershipLevelsQuery();
  const membershipQuery = useMyMembershipQuery();
  const checkoutMutation = useCreateOrderMutation();
  const cancelMutation = useCancelMembershipMutation();

  const purchasePlan = async (planId: string) => {
    const checkout = await checkoutMutation.mutateAsync({
      orderType: 'MEMBERSHIP',
      productId: planId,
    });
    if (checkout.checkoutUrl) {
      (options.assignUrl ?? openRuntimeUrl)(checkout.checkoutUrl);
      options.navigateToOrder?.(checkout.order.id);
      return;
    }
    options.onCheckoutFallback?.();
  };

  const cancelAtPeriodEnd = async () => {
    await cancelMutation.mutateAsync();
  };

  return {
    levels: levelsQuery.data?.levels ?? [],
    isFirstTime: levelsQuery.data?.isFirstTime ?? false,
    membership: membershipQuery.data?.membership ?? null,
    isLoading: levelsQuery.isLoading || membershipQuery.isLoading,
    cycle,
    setCycle,
    autoRenew,
    setAutoRenew,
    purchasingId: checkoutMutation.isPending
      ? checkoutMutation.variables?.productId ?? null
      : null,
    isCancelling: cancelMutation.isPending,
    purchasePlan,
    cancelAtPeriodEnd,
  };
}

export function useMembershipInviteOverviewQuery() {
  return useQuery({
    queryKey: membershipUserQueryKeys.inviteOverview(),
    queryFn: membershipUserActions.getInviteOverview,
  });
}

export function useMembershipInviteController(options: {
  invitePath?: string;
  copyResetMs?: number;
} & Pick<MembershipRuntimeOptions, 'getOrigin' | 'writeClipboardText' | 'setTimeout'> = {}) {
  const [copiedField, setCopiedField] = useState<'code' | 'link' | null>(null);
  const inviteOverviewQuery = useMembershipInviteOverviewQuery();
  const code = inviteOverviewQuery.data?.code ?? null;
  const records: InviteRecord[] = inviteOverviewQuery.data?.records ?? [];
  const invitePath = options.invitePath ?? '/register';
  const inviteLink = code
    ? `${(options.getOrigin ?? getRuntimeOrigin)()}${invitePath}?aff=${code.code}`
    : '';

  const copyToClipboard = (text: string, field: 'code' | 'link') => {
    void (options.writeClipboardText ?? writeRuntimeClipboardText)(text);
    setCopiedField(field);
    (options.setTimeout ?? setRuntimeTimeout)(
      () => setCopiedField(null),
      options.copyResetMs ?? 2000,
    );
  };

  return {
    code,
    records,
    copiedField,
    inviteLink,
    isLoading: inviteOverviewQuery.isLoading,
    copyToClipboard,
  };
}

export function useMembershipCenterController(options: {
  invitePath?: string;
  copyResetMs?: number;
} & Pick<MembershipRuntimeOptions, 'getOrigin' | 'writeClipboardText' | 'setTimeout'> = {}) {
  const membershipQuery = useMyMembershipQuery();
  const inviteController = useMembershipInviteController(options);

  return {
    info: membershipQuery.data ?? null,
    inviteCode: inviteController.code,
    inviteLink: inviteController.inviteLink,
    copied: inviteController.copiedField === 'link',
    isLoading: membershipQuery.isLoading || inviteController.isLoading,
    copyInviteLink: () => {
      if (!inviteController.inviteLink) return;
      inviteController.copyToClipboard(inviteController.inviteLink, 'link');
    },
  };
}
