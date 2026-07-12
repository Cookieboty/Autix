'use client';

import type { ReactNode } from 'react';
import {
  BookOpen,
  Bookmark,
  Check,
  Clock,
  Coins,
  Copy,
  Crown,
  Gift,
  Package,
  Share2,
  ShoppingBag,
  Sparkles,
  Star,
  Settings,
  Upload,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { MeTab, MembershipInfo, PlatformStats, ResourceType } from '@autix/shared-store';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  SidebarTrigger,
} from '../ui';
import {
  ProfileResourcesPanel,
  type ProfileResourceRow,
} from '../resources';
import { AccountSecuritySection, type AccountSecuritySectionProps } from './AccountSecuritySection';
import { AccountSelfServiceView, type AccountSelfServiceViewProps } from '../security/AccountSelfServiceView';

export type ProfileTabKey = MeTab | 'membership' | 'library' | 'settings';

export type ProfileUserSummary = {
  realName?: string | null;
  username?: string | null;
  email?: string | null;
  avatar?: string | null;
  nickname?: string | null;
};

export type ProfileMainTab = {
  key: ProfileTabKey;
  labelKey: string;
  icon?: ReactNode;
};

export type ProfileMembershipAction = {
  labelKey: string;
  icon: typeof Crown;
  href: string;
};

export const DEFAULT_PROFILE_TABS: ProfileMainTab[] = [
  { key: 'acquired', labelKey: 'tabAcquired', icon: <Sparkles className="h-3.5 w-3.5" /> },
  { key: 'favorites', labelKey: 'tabFavorites', icon: <Star className="h-3.5 w-3.5" /> },
  { key: 'generations', labelKey: 'tabGenerations', icon: <Clock className="h-3.5 w-3.5" /> },
  { key: 'published', labelKey: 'tabPublished', icon: <Upload className="h-3.5 w-3.5" /> },
  { key: 'history', labelKey: 'tabHistory', icon: <Bookmark className="h-3.5 w-3.5" /> },
  { key: 'library', labelKey: 'tabLibrary', icon: <BookOpen className="h-3.5 w-3.5" /> },
  { key: 'membership', labelKey: 'tabMembership', icon: <Crown className="h-3.5 w-3.5" /> },
  { key: 'settings', labelKey: 'tabSettings', icon: <Settings className="h-3.5 w-3.5" /> },
];

export const DEFAULT_PROFILE_MEMBERSHIP_ACTIONS: ProfileMembershipAction[] = [
  { labelKey: 'upgrade', icon: Crown, href: '/membership/upgrade' },
  { labelKey: 'pointsHistory', icon: Coins, href: '/membership/points' },
  { labelKey: 'buyPoints', icon: Package, href: '/membership/packages' },
  { labelKey: 'myOrders', icon: ShoppingBag, href: '/membership/orders' },
  { labelKey: 'inviteFriends', icon: Gift, href: '/membership/invite' },
];

export function isProfileResourceTab(tab: ProfileTabKey): tab is MeTab {
  return tab !== 'membership' && tab !== 'library' && tab !== 'settings';
}

export function ProfileTopBar({
  titleKey = 'profileTitle',
  showSidebarTrigger = true,
}: {
  titleKey?: string;
  showSidebarTrigger?: boolean;
}) {
  const t = useTranslations('profile.resources');

  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
      {showSidebarTrigger && <SidebarTrigger className="-ml-1" />}
      <h1 className={`${showSidebarTrigger ? 'ml-1 ' : ''}text-sm font-semibold text-foreground`}>
        {t(titleKey)}
      </h1>
    </div>
  );
}

export function ProfileUserHeader({
  user,
  stats,
}: {
  user: ProfileUserSummary | null | undefined;
  stats: PlatformStats | null;
}) {
  const t = useTranslations('profile.resources');
  const nickname = user?.nickname || user?.realName || user?.username || t('notLoggedIn');
  const initial = (nickname[0] || '?').toUpperCase();

  return (
    <section className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <Avatar size="lg" className="size-16 sm:size-18">
          {user?.avatar && <AvatarImage src={user.avatar} alt={nickname} />}
          <AvatarFallback className="bg-primary text-2xl font-semibold text-primary-foreground">
            {initial}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold text-foreground">{nickname}</div>
          <div className="mt-1 text-xs text-muted-foreground">{user?.email ?? '—'}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6 border-t border-border pt-4 text-center sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
        <ProfileStat label={t('stats.publishedResources')} value={stats?.totalResources ?? 0} />
        <ProfileStat label={t('stats.platformFavorites')} value={stats?.totalAcquisitions ?? 0} />
      </div>
    </section>
  );
}

export function ProfileStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-base font-semibold text-foreground">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export function ProfileFeaturePanel({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <Card>
      <CardContent>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          <Button className="shrink-0 cursor-pointer" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProfileTabStrip({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: ProfileMainTab[];
  activeTab: ProfileTabKey;
  onTabChange: (tab: ProfileTabKey) => void;
}) {
  const t = useTranslations('profile.resources');

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-border">
      {tabs.map((tabItem) => {
        const active = activeTab === tabItem.key;
        return (
          <button
            key={tabItem.key}
            type="button"
            onClick={() => onTabChange(tabItem.key)}
            className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors ${active
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
          >
            {tabItem.icon} {t(`tabs.${tabItem.labelKey}`)}
          </button>
        );
      })}
    </div>
  );
}

export function ProfileMembershipPanel({
  info,
  inviteLink,
  inviteCodeVisible,
  copied,
  loading,
  actions = DEFAULT_PROFILE_MEMBERSHIP_ACTIONS,
  onNavigate,
  onCopyInviteLink,
}: {
  info: MembershipInfo | null;
  inviteLink: string;
  inviteCodeVisible: boolean;
  copied: boolean;
  loading: boolean;
  actions?: ProfileMembershipAction[];
  onNavigate: (href: string) => void;
  onCopyInviteLink: () => void;
}) {
  const t = useTranslations('membership');
  const tProfile = useTranslations('profile.resources');

  if (loading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">{tProfile('loading')}</div>;
  }

  const membership = info?.membership;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <ProfileStat label={t('currentLevel')} value={membership?.level.name ?? t('noMembership')} />
            <ProfileStat label={t('pointsBalance')} value={info?.pointsBalance ?? 0} />
            <ProfileStat
              label={t('expiresAt')}
              value={membership ? new Date(membership.expiresAt).toLocaleDateString() : '—'}
            />
            <ProfileStat
              label={t('autoRenew')}
              value={membership ? (membership.autoRenew ? t('autoRenewOn') : t('autoRenewOff')) : '—'}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {actions.map(({ labelKey, icon: Icon, href }) => (
          <Card
            key={href}
            size="sm"
            className="cursor-pointer transition-colors hover:bg-muted"
            onClick={() => onNavigate(href)}
          >
            <CardContent className="flex flex-col items-center gap-2.5 py-2">
              <Icon className="h-5 w-5 text-primary" />
              <span className="text-xs font-medium text-foreground">{t(labelKey)}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {inviteCodeVisible && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Share2 className="h-4 w-4 text-primary" />
              {tProfile('invitePromotion')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
              <span className="flex-1 truncate font-mono text-xs text-foreground">
                {inviteLink}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0 cursor-pointer"
                onClick={onCopyInviteLink}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span className="ml-1 text-xs">{copied ? tProfile('copied') : t('copyLink')}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function ProfileStatsBar({
  stats,
  totalPointsSpent,
  publishedCount,
}: {
  stats: PlatformStats | null;
  totalPointsSpent: number | null;
  publishedCount: number | null;
}) {
  const t = useTranslations('profile.resources');

  return (
    <Card className="mt-6">
      <CardContent className="flex flex-wrap items-center gap-8 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">{t('stats.publishedResources')}</div>
          <div className="mt-1 font-semibold text-foreground">{publishedCount ?? '—'}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{t('stats.spentPoints')}</div>
          <div className="mt-1 font-semibold text-foreground">{totalPointsSpent ?? '—'}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{t('stats.platformResources')}</div>
          <div className="mt-1 font-semibold text-foreground">{stats?.totalResources ?? '—'}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{t('stats.platformAcquisitions')}</div>
          <div className="mt-1 font-semibold text-foreground">{stats?.totalAcquisitions ?? '—'}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProfileView({
  user,
  stats,
  tabs,
  activeTab,
  resourceRows,
  resourceLoading,
  totalPointsSpent,
  membership,
  onTabChange,
  onResourceClick,
  onNavigate,
  basicsSlot,
  accountSecurity,
  accountSelfService,
}: {
  user: ProfileUserSummary | null | undefined;
  stats: PlatformStats | null;
  tabs: ProfileMainTab[];
  activeTab: ProfileTabKey;
  resourceRows: ProfileResourceRow[];
  resourceLoading: boolean;
  totalPointsSpent: number | null;
  membership: {
    info: MembershipInfo | null;
    inviteLink: string;
    inviteCodeVisible: boolean;
    copied: boolean;
    loading: boolean;
    onCopyInviteLink: () => void;
  };
  onTabChange: (tab: ProfileTabKey) => void;
  onResourceClick: (type: ResourceType | undefined, id: string | undefined) => void;
  onNavigate: (href: string) => void;
  basicsSlot?: ReactNode;
  accountSecurity?: AccountSecuritySectionProps;
  accountSelfService?: AccountSelfServiceViewProps;
}) {
  const t = useTranslations('profile.resources');
  const resourceTab = isProfileResourceTab(activeTab) ? activeTab : null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ProfileTopBar />
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <ProfileUserHeader user={user} stats={stats} />

        <div className="mt-6">
          <ProfileTabStrip
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={onTabChange}
          />
        </div>

        <div className="mt-4">
          {activeTab === 'membership' ? (
            <ProfileMembershipPanel
              info={membership.info}
              inviteLink={membership.inviteLink}
              inviteCodeVisible={membership.inviteCodeVisible}
              copied={membership.copied}
              loading={membership.loading}
              onNavigate={onNavigate}
              onCopyInviteLink={membership.onCopyInviteLink}
            />
          ) : activeTab === 'library' ? (
            <ProfileFeaturePanel
              icon={<BookOpen className="h-5 w-5" />}
              title={t('library.title')}
              description={t('library.description')}
              actionLabel={t('library.action')}
              onAction={() => onNavigate('/library')}
            />
          ) : activeTab === 'settings' ? (
            <div className="space-y-6">
              {basicsSlot}
              {accountSecurity ? <AccountSecuritySection {...accountSecurity} /> : null}
              {accountSelfService ? <AccountSelfServiceView {...accountSelfService} /> : null}
            </div>
          ) : (
            <ProfileResourcesPanel
              rows={resourceRows}
              tab={activeTab}
              loading={resourceLoading}
              onClickRow={onResourceClick}
            />
          )}
        </div>

        {activeTab !== 'settings' ? (
          <ProfileStatsBar
            stats={stats}
            totalPointsSpent={totalPointsSpent}
            publishedCount={resourceTab === 'published' ? resourceRows.length : null}
          />
        ) : null}
      </div>
    </div>
  );
}

export function ProfileOverviewView({
  user,
  stats,
  accountSecurity,
  accountSelfService,
  basicsSlot,
}: {
  user: ProfileUserSummary | null | undefined;
  stats: PlatformStats | null;
  accountSecurity?: AccountSecuritySectionProps;
  accountSelfService?: AccountSelfServiceViewProps;
  /**
   * T13: 由 client 页注入的"基础资料自助编辑"面板（nickname/description/avatar）。
   * 与 AccountSelfService（改邮箱/密码/删号）在语义上分层，独立成 slot 避免耦合。
   */
  basicsSlot?: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ProfileTopBar />
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:py-8">
        <div className="mx-auto w-full max-w-6xl">
          <ProfileUserHeader user={user} stats={stats} />
          <div className="mt-6 grid items-start gap-6 lg:grid-cols-12">
            {basicsSlot ? <div className="lg:col-span-7">{basicsSlot}</div> : null}
            {accountSecurity ? <div className="lg:col-span-5"><AccountSecuritySection {...accountSecurity} /></div> : null}
          </div>
          {accountSelfService ? <div className="mt-6"><AccountSelfServiceView {...accountSelfService} /></div> : null}
        </div>
      </div>
    </div>
  );
}
