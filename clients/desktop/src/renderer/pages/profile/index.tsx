'use client';

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  DEFAULT_PROFILE_TABS,
  ProfileBasicsForm,
  ProfileView,
  isProfileResourceTab,
  type ProfileTabKey,
} from '@autix/shared-ui/profile';
import { useProfileResourceRows } from '@autix/shared-ui/resources';
import { RESOURCE_TYPE_TO_SLUG } from '@autix/shared-ui/marketplace';
import { useSystemFeatureFlag } from '@autix/shared-ui/hooks';
import { mapOAuthErrorKey, type OAuthProviderId } from '@autix/shared-ui/auth';
import { useTranslations } from 'next-intl';
import {
  membershipUserActions,
  authActions,
  oauthLinkingKeys,
  securityActions,
  useAuthStore,
  useLinkedAccountsQuery,
  useUnlinkAccountMutation,
  useProfilePlatformStatsController,
  useProfileResourcesController,
  type InviteCode,
  type MembershipInfo,
  type ResourceType,
} from '@autix/shared-store';
import { getOAuthLink, getOAuthStepUp } from '@autix/platform';
import { StepUpDialog } from '@autix/shared-ui/security';
import type { StepUpPurpose } from '@autix/domain';

export function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tAuth = useTranslations('auth');
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const [allProviders, setAllProviders] = useState<OAuthProviderId[]>([]);
  const [busyProvider, setBusyProvider] = useState<OAuthProviderId | null>(null);
  const [linkError, setLinkError] = useState('');
  // 安全（#3）：link/unlink 前先经 step-up 换取一次性 proof（purpose='unlink-provider'）。
  const [pendingLink, setPendingLink] = useState<{ action: 'link' | 'unlink'; provider: OAuthProviderId } | null>(null);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const linkedQuery = useLinkedAccountsQuery();
  const unlink = useUnlinkAccountMutation();
  const libraryFeature = useSystemFeatureFlag('libraryEnabled', false);

  const initialTab = (searchParams.get('tab') as ProfileTabKey) || 'acquired';
  const [tab, setTab] = useState<ProfileTabKey>(initialTab);
  const resourceTab = isProfileResourceTab(tab) ? tab : null;
  const { items, loading } = useProfileResourcesController(
    resourceTab ?? 'acquired',
    { page: 1, pageSize: 30 },
    Boolean(resourceTab),
  );
  const { stats } = useProfilePlatformStatsController();
  const [membershipInfo, setMembershipInfo] = useState<MembershipInfo | null>(null);
  const [inviteCode, setInviteCode] = useState<InviteCode | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const normalizedRows = useProfileResourceRows(items, resourceTab ?? 'acquired');

  useEffect(() => {
    authActions.fetchOAuthProviders()
      .then(({ providers }) => setAllProviders(providers as OAuthProviderId[]))
      .catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([
      membershipUserActions.getMe().then(setMembershipInfo),
      membershipUserActions
        .getInviteCode()
        .then(setInviteCode)
        .catch(() => {}),
    ]).finally(() => setMembershipLoading(false));
  }, []);

  useEffect(() => {
    if (libraryFeature.loading || libraryFeature.enabled || tab !== 'library') return;
    setTab('acquired');
    setSearchParams({ tab: 'acquired' }, { replace: true });
  }, [libraryFeature.enabled, libraryFeature.loading, setSearchParams, tab]);

  const tabs = useMemo(
    () => DEFAULT_PROFILE_TABS.filter((item) => item.key !== 'library' || libraryFeature.enabled),
    [libraryFeature.enabled],
  );

  const rows = resourceTab ? normalizedRows : [];
  const totalPointsSpent = useMemo(() => {
    if (resourceTab !== 'acquired') return null;
    return items.reduce((sum, it) => sum + (it.pointsPaid ?? 0), 0);
  }, [items, resourceTab]);

  const inviteLink = inviteCode
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/register?aff=${inviteCode.code}`
    : '';

  const handleCopyInviteLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTabChange = (nextTab: ProfileTabKey) => {
    setTab(nextTab);
    setSearchParams({ tab: nextTab });
  };

  const startOAuthStepUp = async (purpose: StepUpPurpose) => {
    const adapter = getOAuthStepUp();
    if (!adapter) throw new Error('STEP_UP_UNAVAILABLE');
    const reservation = await adapter.reserve('auto');
    try {
      const start = await securityActions.startStepUpForOAuth({
        purpose,
        clientType: 'desktop',
        redirectUri: reservation.redirectUri,
      });
      if (start.kind !== 'redirect') {
        await adapter.cancel(reservation.flowId);
        return start;
      }
      const result = await adapter.complete({
        flowId: reservation.flowId,
        authorizeUrl: start.authorizeUrl,
        expectedPurpose: purpose,
      });
      return { kind: 'proof' as const, proof: result.proof };
    } catch (error) {
      await adapter.cancel(reservation.flowId).catch(() => {});
      throw error;
    }
  };

  const linkOAuthProvider = async (provider: OAuthProviderId, proof: string) => {
    const adapter = getOAuthLink();
    if (!adapter) throw new Error('OAUTH_LINK_UNAVAILABLE');
    const reservation = await adapter.reserve(provider);
    try {
      const { authorizeUrl } = await authActions.getLinkAuthorizeUrl(provider, {
        systemCode: 'chat',
        clientType: 'desktop',
        redirectUri: reservation.redirectUri,
        proof,
      });
      await adapter.complete({
        flowId: reservation.flowId,
        authorizeUrl,
        expectedProvider: provider,
      });
      await queryClient.invalidateQueries({ queryKey: oauthLinkingKeys.linked() });
    } catch (error) {
      await adapter.cancel(reservation.flowId).catch(() => {});
      throw error;
    }
  };

  // step-up 换到 proof 后真正执行 link/unlink（安全 #3）。
  const runLinkedAccountAction = async (proof: string) => {
    const pending = pendingLink;
    setStepUpOpen(false);
    setPendingLink(null);
    if (!pending) return;
    const provider = pending.provider;
    if (pending.action === 'unlink') {
      unlink.mutate({ provider, proof });
      return;
    }
    setBusyProvider(provider);
    setLinkError('');
    try {
      await linkOAuthProvider(provider, proof);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'OAUTH_GENERIC';
      setLinkError(tAuth(mapOAuthErrorKey(code)));
    } finally {
      setBusyProvider(null);
    }
  };

  const linkedProviders = (linkedQuery.data ?? []) as OAuthProviderId[];
  const accountSecurity = (allProviders.length > 0 || linkedProviders.length > 0) ? {
    allProviders,
    linkedProviders,
    busyProvider: busyProvider ?? (unlink.isPending ? (unlink.variables?.provider as OAuthProviderId) : null),
    error: linkError,
    onLink: (provider: OAuthProviderId) => { setLinkError(''); setPendingLink({ action: 'link', provider }); setStepUpOpen(true); },
    onUnlink: (provider: OAuthProviderId) => { setLinkError(''); setPendingLink({ action: 'unlink', provider }); setStepUpOpen(true); },
  } : undefined;

  const goDetail = (resourceType: ResourceType | undefined, resourceId: string | undefined) => {
    if (!resourceType || !resourceId) return;
    const slug = RESOURCE_TYPE_TO_SLUG[resourceType];
    if (!slug) return;
    navigate(`/marketplace/${slug}/${resourceId}`);
  };

  return (
    <>
    <ProfileView
      user={user}
      stats={stats}
      tabs={tabs}
      activeTab={tab}
      resourceRows={rows}
      resourceLoading={loading}
      totalPointsSpent={totalPointsSpent}
      membership={{
        info: membershipInfo,
        inviteLink,
        inviteCodeVisible: Boolean(inviteCode),
        copied,
        loading: membershipLoading,
        onCopyInviteLink: handleCopyInviteLink,
      }}
      onTabChange={handleTabChange}
      onResourceClick={goDetail}
      onNavigate={(href) => navigate(href)}
      basicsSlot={user ? <ProfileBasicsForm /> : null}
      accountSecurity={accountSecurity}
      accountSelfService={user ? {
        currentEmail: user.email,
        pendingEmail: user.pendingEmail,
        hasPassword: Boolean(user.hasPassword),
        currentUsername: user.username,
        isSuperAdmin: Boolean(user.isSuperAdmin),
        startOAuthStepUp,
        onAccountDeleted: () => navigate('/login', { replace: true }),
      } : undefined}
    />
    {pendingLink ? (
      <StepUpDialog
        purpose="unlink-provider"
        hasPassword={Boolean(user?.hasPassword)}
        startOAuthStepUp={startOAuthStepUp}
        onProof={runLinkedAccountAction}
        open={stepUpOpen}
        onOpenChange={(o) => { setStepUpOpen(o); if (!o) setPendingLink(null); }}
      />
    ) : null}
    </>
  );
}
