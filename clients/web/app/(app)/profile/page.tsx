'use client';
import { useEffect, useState } from 'react';
import { ProfileOverviewView } from '@autix/shared-ui/profile';
import type { OAuthProviderId } from '@autix/shared-ui/auth';
import { useProfilePlatformStatsController, useAuthStore, authActions, useLinkedAccountsQuery, useUnlinkAccountMutation } from '@autix/shared-store';

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const { stats } = useProfilePlatformStatsController();
  const [allProviders, setAllProviders] = useState<OAuthProviderId[]>([]);
  const [busy, setBusy] = useState<OAuthProviderId | null>(null);
  const linkedQuery = useLinkedAccountsQuery();
  const unlink = useUnlinkAccountMutation();

  useEffect(() => { authActions.fetchOAuthProviders().then((l) => setAllProviders(l as OAuthProviderId[])).catch(() => {}); }, []);

  const linkedProviders = (linkedQuery.data ?? []) as OAuthProviderId[];
  const accountSecurity = (allProviders.length || linkedProviders.length) ? {
    allProviders,
    linkedProviders,
    busyProvider: busy ?? (unlink.isPending ? (unlink.variables as OAuthProviderId) : null),
    onLink: (p: OAuthProviderId) => { setBusy(p); authActions.linkAccount(p, { systemCode: 'chat', redirectUri: `${window.location.origin}/oauth/callback` }).catch(() => setBusy(null)); },
    onUnlink: (p: OAuthProviderId) => unlink.mutate(p),
  } : undefined;

  return <ProfileOverviewView user={user} stats={stats} accountSecurity={accountSecurity} />;
}
