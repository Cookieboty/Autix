import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  riskAdminActions,
  type RiskLevel,
  type RiskUsersParams,
} from './risk-admin.actions';

export const riskAdminQueryKeys = {
  root: () => ['riskAdmin'] as const,
  users: (params: RiskUsersParams) =>
    ['riskAdmin', 'users', params.level ?? '', params.page ?? 1, params.pageSize ?? 20] as const,
  userDetail: (userId: string) => ['riskAdmin', 'users', userId] as const,
};

export function useRiskUsersQuery(params: RiskUsersParams) {
  return useQuery({
    queryKey: riskAdminQueryKeys.users(params),
    queryFn: () => riskAdminActions.listUsers(params),
  });
}

export function useRiskUserDetailQuery(userId: string, enabled = true) {
  return useQuery({
    queryKey: riskAdminQueryKeys.userDetail(userId),
    queryFn: () => riskAdminActions.getUser(userId),
    enabled: enabled && Boolean(userId),
  });
}

type RiskMutationCallbacks = {
  onSuccess?: () => void | Promise<void>;
  onError?: (error: unknown) => void;
};

function useRiskInvalidator() {
  const queryClient = useQueryClient();
  return (userId?: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: riskAdminQueryKeys.root() }),
      userId
        ? queryClient.invalidateQueries({ queryKey: riskAdminQueryKeys.userDetail(userId) })
        : Promise.resolve(),
    ]);
}

export function useSetRiskLevelMutation(callbacks?: RiskMutationCallbacks) {
  const invalidate = useRiskInvalidator();
  return useMutation({
    mutationFn: (vars: { userId: string; level: RiskLevel; reason?: string }) =>
      riskAdminActions.setLevel(vars.userId, vars.level, vars.reason),
    onSuccess: async (_data, vars) => {
      await invalidate(vars.userId);
      await callbacks?.onSuccess?.();
    },
    onError: (error) => callbacks?.onError?.(error),
  });
}

export function useBlockRiskUserMutation(callbacks?: RiskMutationCallbacks) {
  const invalidate = useRiskInvalidator();
  return useMutation({
    mutationFn: (vars: { userId: string; reason?: string }) =>
      riskAdminActions.block(vars.userId, vars.reason),
    onSuccess: async (_data, vars) => {
      await invalidate(vars.userId);
      await callbacks?.onSuccess?.();
    },
    onError: (error) => callbacks?.onError?.(error),
  });
}

export function useUnblockRiskUserMutation(callbacks?: RiskMutationCallbacks) {
  const invalidate = useRiskInvalidator();
  return useMutation({
    mutationFn: (vars: { userId: string; reason?: string }) =>
      riskAdminActions.unblock(vars.userId, vars.reason),
    onSuccess: async (_data, vars) => {
      await invalidate(vars.userId);
      await callbacks?.onSuccess?.();
    },
    onError: (error) => callbacks?.onError?.(error),
  });
}
