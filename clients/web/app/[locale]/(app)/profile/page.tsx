'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ProfileOverviewView, ProfileBasicsForm } from '@autix/shared-ui/profile';
import { mapOAuthErrorKey, type OAuthProviderId } from '@autix/shared-ui/auth';
import { StepUpDialog } from '@autix/shared-ui/security';
import { useProfilePlatformStatsController, useAuthStore, authActions, useLinkedAccountsQuery, useUnlinkAccountMutation, oauthLinkingKeys } from '@autix/shared-store';
import { linkWithPopup, stepUpWithPopup } from '@/lib/oauth-popup-flow';
import { useRouter } from '@/i18n/navigation';

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const { stats } = useProfilePlatformStatsController();
  const [allProviders, setAllProviders] = useState<OAuthProviderId[]>([]);
  const [busy, setBusy] = useState<OAuthProviderId | null>(null);
  const [linkError, setLinkError] = useState('');
  // 安全（#3）：link/unlink 前先经 step-up 换取一次性 proof（purpose='unlink-provider'）。
  const [pendingLink, setPendingLink] = useState<{ action: 'link' | 'unlink'; provider: OAuthProviderId } | null>(null);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const linkedQuery = useLinkedAccountsQuery();
  const unlink = useUnlinkAccountMutation();
  const searchParams = useSearchParams();
  const linked = searchParams.get('linked');
  const queryClient = useQueryClient();
  const router = useRouter();
  const t = useTranslations('profile');
  const tAuth = useTranslations('auth');

  useEffect(() => { authActions.fetchOAuthProviders().then(({ providers }) => setAllProviders(providers as OAuthProviderId[])).catch(() => { }); }, []);

  useEffect(() => {
    if (linked) {
      void queryClient.invalidateQueries({ queryKey: oauthLinkingKeys.linked() });
    }
  }, [linked, queryClient]);

  const hasPassword = Boolean((user as { hasPassword?: boolean } | null)?.hasPassword);
  const linkedProviders = (linkedQuery.data ?? []) as OAuthProviderId[];

  // step-up 换到 proof 后真正执行 link/unlink（安全 #3）。
  const runLinkedAccountAction = async (proof: string) => {
    const pending = pendingLink;
    setStepUpOpen(false);
    setPendingLink(null);
    if (!pending) return;
    const p = pending.provider;
    if (pending.action === 'unlink') {
      unlink.mutate({ provider: p, proof });
      return;
    }
    setBusy(p);
    setLinkError('');
    try {
      const outcome = await linkWithPopup({ provider: p, proof });
      if (outcome.kind === 'linked') {
        void queryClient.invalidateQueries({ queryKey: oauthLinkingKeys.linked() });
      } else if (outcome.kind === 'error') {
        setLinkError(tAuth(mapOAuthErrorKey(outcome.code)));
      }
      // redirected: 已整页跳走;cancelled: 静默
    } catch {
      setLinkError(tAuth('oauthGenericError'));
    } finally {
      setBusy(null);
    }
  };

  const accountSecurity = (allProviders.length || linkedProviders.length) ? {
    allProviders,
    linkedProviders,
    busyProvider: busy ?? (unlink.isPending ? (unlink.variables?.provider as OAuthProviderId) : null),
    error: linkError,
    onLink: (p: OAuthProviderId) => { setLinkError(''); setPendingLink({ action: 'link', provider: p }); setStepUpOpen(true); },
    onUnlink: (p: OAuthProviderId) => { setLinkError(''); setPendingLink({ action: 'unlink', provider: p }); setStepUpOpen(true); },
  } : undefined;

  return (
    <>
      {linked ? (
        <div className="mb-4 rounded-md bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
          {t('accountLinkedSuccess')}
        </div>
      ) : null}
      <ProfileOverviewView
        user={user}
        stats={stats}
        accountSecurity={accountSecurity}
        basicsSlot={user ? <ProfileBasicsForm /> : null}
        accountSelfService={user ? {
          currentEmail: user.email ?? null,
          pendingEmail: (user as { pendingEmail?: string | null }).pendingEmail ?? null,
          hasPassword: Boolean((user as { hasPassword?: boolean }).hasPassword),
          currentUsername: user.username ?? null,
          isSuperAdmin: Boolean(user.isSuperAdmin),
          onAccountDeleted: () => { router.replace('/login'); },
          startOAuthStepUp: stepUpWithPopup,
        } : undefined}
      />
      {pendingLink ? (
        <StepUpDialog
          purpose="unlink-provider"
          hasPassword={hasPassword}
          startOAuthStepUp={stepUpWithPopup}
          onProof={runLinkedAccountAction}
          open={stepUpOpen}
          onOpenChange={(o) => { setStepUpOpen(o); if (!o) setPendingLink(null); }}
        />
      ) : null}
    </>
  );
}
