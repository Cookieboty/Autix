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
    mutationFn: (provider: string) => authActions.unlinkAccount(provider),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: oauthLinkingKeys.linked() });
      await cb?.onSuccess?.();
    },
    onError: (e) => cb?.onError?.(e),
  });
}
