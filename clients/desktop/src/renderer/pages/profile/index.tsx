'use client';

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  DEFAULT_PROFILE_TABS,
  ProfileView,
  isProfileResourceTab,
  type ProfileTabKey,
} from '@autix/shared-ui/profile';
import { useProfileResourceRows } from '@autix/shared-ui/resources';
import { RESOURCE_TYPE_TO_SLUG } from '@autix/shared-ui/marketplace';
import { useSystemFeatureFlag } from '@autix/shared-ui/hooks';
import {
  membershipUserActions,
  useAuthStore,
  useProfilePlatformStatsController,
  useProfileResourcesController,
  type InviteCode,
  type MembershipInfo,
  type ResourceType,
} from '@autix/shared-store';

export function ProfilePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
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

  const goDetail = (resourceType: ResourceType | undefined, resourceId: string | undefined) => {
    if (!resourceType || !resourceId) return;
    const slug = RESOURCE_TYPE_TO_SLUG[resourceType];
    if (!slug) return;
    navigate(`/marketplace/${slug}/${resourceId}`);
  };

  return (
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
    />
  );
}
