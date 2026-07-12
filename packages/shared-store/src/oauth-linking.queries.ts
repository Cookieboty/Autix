import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authActions } from './auth.store';

export const oauthLinkingKeys = {
  linked: () => ['oauth', 'linked'] as const,
};

export function useLinkedAccountsQuery(enabled = true) {
  return useQuery({
    queryKey: oauthLinkingKeys.linked(),
    queryFn: authActions.listLinkedAccounts,
    enabled,
  });
}

export function useUnlinkAccountMutation(cb?: {
  onSuccess?: () => void;
  onError?: (e: unknown) => void;
}) {
  const qc = useQueryClient();
  return useMutation({
    // 安全（#3）：解绑需带 step-up 一次性 proof。
    mutationFn: (vars: { provider: string; proof: string }) =>
      authActions.unlinkAccount(vars.provider, vars.proof),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: oauthLinkingKeys.linked() });
      await cb?.onSuccess?.();
    },
    onError: (e) => cb?.onError?.(e),
  });
}
