'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ProfileOverviewView } from '@autix/shared-ui/profile';
import { mapOAuthErrorKey, type OAuthProviderId } from '@autix/shared-ui/auth';
import { useProfilePlatformStatsController, useAuthStore, authActions, useLinkedAccountsQuery, useUnlinkAccountMutation, oauthLinkingKeys } from '@autix/shared-store';
import { linkWithPopup } from '@/lib/oauth-popup-flow';

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const { stats } = useProfilePlatformStatsController();
  const [allProviders, setAllProviders] = useState<OAuthProviderId[]>([]);
  const [busy, setBusy] = useState<OAuthProviderId | null>(null);
  const [linkError, setLinkError] = useState('');
  const linkedQuery = useLinkedAccountsQuery();
  const unlink = useUnlinkAccountMutation();
  const searchParams = useSearchParams();
  const linked = searchParams.get('linked');
  const queryClient = useQueryClient();
  const t = useTranslations('profile');
  const tAuth = useTranslations('auth');

  useEffect(() => { authActions.fetchOAuthProviders().then(({ providers }) => setAllProviders(providers as OAuthProviderId[])).catch(() => {}); }, []);

  useEffect(() => {
    if (linked) {
      void queryClient.invalidateQueries({ queryKey: oauthLinkingKeys.linked() });
    }
  }, [linked, queryClient]);

  const linkedProviders = (linkedQuery.data ?? []) as OAuthProviderId[];
  const accountSecurity = (allProviders.length || linkedProviders.length) ? {
    allProviders,
    linkedProviders,
    busyProvider: busy ?? (unlink.isPending ? (unlink.variables as OAuthProviderId) : null),
    error: linkError,
    onLink: (p: OAuthProviderId) => {
      setBusy(p);
      setLinkError('');
      linkWithPopup({ provider: p })
        .then((outcome) => {
          if (outcome.kind === 'linked') {
            void queryClient.invalidateQueries({ queryKey: oauthLinkingKeys.linked() });
          } else if (outcome.kind === 'error') {
            setLinkError(tAuth(mapOAuthErrorKey(outcome.code)));
          }
          // redirected: 已整页跳走;cancelled: 静默
        })
        .catch(() => setLinkError(tAuth('oauthGenericError')))
        .finally(() => setBusy(null));
    },
    onUnlink: (p: OAuthProviderId) => unlink.mutate(p),
  } : undefined;

  return (
    <>
      {linked ? (
        <div className="mb-4 rounded-md bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
          {t('accountLinkedSuccess')}
        </div>
      ) : null}
      <ProfileOverviewView user={user} stats={stats} accountSecurity={accountSecurity} />
    </>
  );
}
