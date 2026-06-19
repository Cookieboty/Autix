'use client';

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import {
  Sparkles,
  Star,
  Clock,
  Upload,
  Bookmark,
  Crown,
  Coins,
  Package,
  ShoppingBag,
  Gift,
  Copy,
  Check,
  Share2,
  BookOpen,
  Settings,
} from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  SidebarTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  CardTitle,
} from '@autix/shared-ui/ui';
import {
  meApi,
  marketplaceApi,
  membershipApi,
  inviteApi,
  type MeTab,
  type ResourceType,
  type MembershipInfo,
  type InviteCode,
} from '@autix/sdk';
import { useSystemFeatureFlag } from '@autix/shared-ui/hooks';
import { RESOURCE_TYPE_TO_SLUG, TYPE_LABEL_KEY } from '@autix/shared-ui/marketplace';
import { useAuthStore } from '@autix/shared-store';

const TYPE_TO_SLUG: Record<ResourceType, string> = {
  SKILL: 'skills',
  MCP: 'mcp',
  AGENT: 'agents',
  IMAGE_TEMPLATE: 'image-templates',
  VIDEO_TEMPLATE: 'video-templates',
};

type ProfileTabKey = MeTab | 'membership' | 'library' | 'models';

interface ProfileTab {
  key: ProfileTabKey;
  labelKey: string;
  icon: React.ReactNode;
}

const TABS: ProfileTab[] = [
  { key: 'acquired', labelKey: 'tabAcquired', icon: <Sparkles className="h-3.5 w-3.5" /> },
  { key: 'favorites', labelKey: 'tabFavorites', icon: <Star className="h-3.5 w-3.5" /> },
  { key: 'generations', labelKey: 'tabGenerations', icon: <Clock className="h-3.5 w-3.5" /> },
  { key: 'published', labelKey: 'tabPublished', icon: <Upload className="h-3.5 w-3.5" /> },
  { key: 'history', labelKey: 'tabHistory', icon: <Bookmark className="h-3.5 w-3.5" /> },
  { key: 'library', labelKey: 'tabLibrary', icon: <BookOpen className="h-3.5 w-3.5" /> },
  { key: 'models', labelKey: 'tabModels', icon: <Settings className="h-3.5 w-3.5" /> },
  { key: 'membership', labelKey: 'tabMembership', icon: <Crown className="h-3.5 w-3.5" /> },
];

interface PlatformStats {
  totalResources: number;
  bySkillCount: number;
  byMcpCount: number;
  byAgentCount: number;
  byImageTemplateCount: number;
  byVideoTemplateCount: number;
  totalAcquisitions: number;
}

interface AggregatedItem {
  id?: string;
  resourceType?: ResourceType;
  resourceId?: string;
  resource?: {
    id: string;
    title: string;
    coverImage?: string | null;
    category?: string | null;
    pointsCost?: number;
    useCount?: number;
    status?: string;
    updatedAt?: string;
  };
  title?: string;
  coverImage?: string | null;
  category?: string | null;
  pointsCost?: number;
  useCount?: number;
  status?: string;
  updatedAt?: string;
  pointsPaid?: number;
  acquiredAt?: string;
  createdAt?: string;
  viewedAt?: string;
  generationType?: ResourceType;
  templateId?: string;
  template?: { title?: string; coverImage?: string | null; category?: string | null };
}

type StatusVariant = 'default' | 'secondary' | 'destructive' | 'outline';

const STATUS_LABEL: Record<string, { label: string; variant: StatusVariant }> = {
  PENDING: { label: 'statusPending', variant: 'secondary' },
  IN_REVIEW: { label: 'statusInReview', variant: 'secondary' },
  APPROVED: { label: 'statusApproved', variant: 'default' },
  REJECTED: { label: 'statusRejected', variant: 'destructive' },
  ARCHIVED: { label: 'statusArchived', variant: 'outline' },
};

export function ProfilePage() {
  const navigate = useNavigate();
  const t = useTranslations('profile.resources');
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const libraryFeature = useSystemFeatureFlag('libraryEnabled', false);

  const initialTab = (searchParams.get('tab') as ProfileTabKey) || 'acquired';
  const [tab, setTab] = useState<ProfileTabKey>(initialTab);
  const [items, setItems] = useState<AggregatedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const resourceTab = isResourceTab(tab) ? tab : null;
  const tabs = useMemo(
    () => TABS.filter((item) => item.key !== 'library' || libraryFeature.enabled),
    [libraryFeature.enabled],
  );

  useEffect(() => {
    if (libraryFeature.loading || libraryFeature.enabled || tab !== 'library') return;
    setTab('acquired');
    setSearchParams({ tab: 'acquired' }, { replace: true });
  }, [libraryFeature.enabled, libraryFeature.loading, setSearchParams, tab]);

  useEffect(() => {
    if (!resourceTab) return;
    let cancelled = false;
    setLoading(true);
    meApi
      .resources(resourceTab, { page: 1, pageSize: 30 })
      .then((res) => {
        if (cancelled) return;
        const data = res.data as { items: AggregatedItem[] };
        setItems(data.items ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resourceTab]);

  useEffect(() => {
    marketplaceApi.platformStats().then((res) => {
      setStats(res.data as PlatformStats);
    });
  }, []);

  const totalPointsSpent = useMemo(() => {
    if (resourceTab !== 'acquired') return null;
    return items.reduce((sum, it) => sum + (it.pointsPaid ?? 0), 0);
  }, [items, resourceTab]);

  const rowLabels = useMemo(
    () => ({
      resource: t('defaultResource'),
      archivedResource: t('archivedResource'),
      generationRecord: t('generationRecord'),
    }),
    [t],
  );
  const rows = useMemo(
    () => (resourceTab ? normalizeRows(items, resourceTab, rowLabels) : []),
    [items, resourceTab, rowLabels],
  );

  const goDetail = (resourceType: ResourceType | undefined, resourceId: string | undefined) => {
    if (!resourceType || !resourceId) return;
    const slug = TYPE_TO_SLUG[resourceType];
    if (!slug) return;
    navigate(`/marketplace/${slug}/${resourceId}`);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ProfileTopBar />
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <UserHeader user={user} stats={stats} />

        <div className="mt-6 flex items-center gap-1 border-b border-border overflow-x-auto">
          {tabs.map((tabItem) => {
            const active = tab === tabItem.key;
            return (
              <button
                key={tabItem.key}
                onClick={() => {
                  setTab(tabItem.key);
                  setSearchParams({ tab: tabItem.key });
                }}
                className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors -mb-px ${
                  active
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tabItem.icon} {t(`tabs.${tabItem.labelKey}`)}
              </button>
            );
          })}
        </div>

        <div className="mt-4">
          {tab === 'membership' ? (
            <MembershipPanel />
          ) : tab === 'library' ? (
            <ProfileFeaturePanel
              icon={<BookOpen className="h-5 w-5" />}
              title={t('library.title')}
              description={t('library.description')}
              actionLabel={t('library.action')}
              onAction={() => navigate('/library')}
            />
          ) : tab === 'models' ? (
            <ProfileFeaturePanel
              icon={<Settings className="h-5 w-5" />}
              title={t('models.title')}
              description={t('models.description')}
              actionLabel={t('models.action')}
              onAction={() => navigate('/models')}
            />
          ) : loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">{t('loading')}</div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">{t('empty')}</div>
          ) : (
            <ResourceTable rows={rows} tab={resourceTab ?? 'acquired'} onClickRow={goDetail} />
          )}
        </div>

        <ProfileStatsBar
          stats={stats}
          totalPointsSpent={totalPointsSpent}
          publishedCount={resourceTab === 'published' ? items.length : null}
        />
      </div>
    </div>
  );
}

function isResourceTab(tab: ProfileTabKey): tab is MeTab {
  return tab !== 'membership' && tab !== 'library' && tab !== 'models';
}

function ProfileTopBar() {
  const t = useTranslations('profile.resources');

  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
      <SidebarTrigger className="-ml-1" />
      <h1 className="ml-1 text-sm font-semibold text-foreground">{t('profileTitle')}</h1>
    </div>
  );
}

function UserHeader({
  user,
  stats,
}: {
  user: ReturnType<typeof useAuthStore.getState>['user'];
  stats: PlatformStats | null;
}) {
  const t = useTranslations('profile.resources');
  const nickname = user?.realName || user?.username || t('notLoggedIn');
  const initial = (nickname[0] || '?').toUpperCase();
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <Avatar size="lg" className="size-16">
          {user?.avatar && <AvatarImage src={user.avatar} alt={nickname} />}
          <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-semibold">
            {initial}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold text-foreground">{nickname}</div>
          <div className="mt-1 text-xs text-muted-foreground">{user?.email ?? '—'}</div>
        </div>
        <div className="flex items-center gap-6 text-center">
          <Stat label={t('stats.publishedResources')} value={stats?.totalResources ?? 0} />
          <Stat label={t('stats.platformFavorites')} value={stats?.totalAcquisitions ?? 0} />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-base font-semibold text-foreground">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

const membershipActions = [
  { labelKey: 'upgrade', icon: Crown, href: '/membership/upgrade' },
  { labelKey: 'pointsHistory', icon: Coins, href: '/membership/points' },
  { labelKey: 'buyPoints', icon: Package, href: '/membership/packages' },
  { labelKey: 'myOrders', icon: ShoppingBag, href: '/membership/orders' },
  { labelKey: 'inviteFriends', icon: Gift, href: '/membership/invite' },
] as const;

function MembershipPanel() {
  const navigate = useNavigate();
  const t = useTranslations('membership');
  const tProfile = useTranslations('profile.resources');
  const [info, setInfo] = useState<MembershipInfo | null>(null);
  const [inviteCode, setInviteCode] = useState<InviteCode | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([
      membershipApi.getMe().then((res) => setInfo(res.data)),
      inviteApi
        .getCode()
        .then((res) => setInviteCode(res.data))
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const inviteLink = inviteCode
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/register?aff=${inviteCode.code}`
    : '';

  const handleCopyLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">{tProfile('loading')}</div>;
  }

  const membership = info?.membership;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label={t('currentLevel')} value={membership?.level.name ?? t('noMembership')} />
            <Stat label={t('pointsBalance')} value={info?.pointsBalance ?? 0} />
            <Stat
              label={t('expiresAt')}
              value={membership ? new Date(membership.expiresAt).toLocaleDateString() : '—'}
            />
            <Stat
              label={t('autoRenew')}
              value={membership ? (membership.autoRenew ? t('autoRenewOn') : t('autoRenewOff')) : '—'}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {membershipActions.map(({ labelKey, icon: Icon, href }) => (
          <Card
            key={href}
            size="sm"
            className="cursor-pointer transition-colors hover:bg-muted"
            onClick={() => navigate(href)}
          >
            <CardContent className="flex flex-col items-center gap-2.5 py-2">
              <Icon className="h-5 w-5 text-primary" />
              <span className="text-xs font-medium text-foreground">{t(labelKey)}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {inviteCode && (
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
                onClick={handleCopyLink}
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

function ProfileFeaturePanel({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: React.ReactNode;
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

interface NormalizedRow {
  key: string;
  title: string;
  cover?: string | null;
  resourceType?: ResourceType;
  resourceId?: string;
  category?: string;
  pointsCost?: number;
  useCount?: number;
  status?: string;
  pointsPaid?: number;
  timestamp?: string;
}

function normalizeRows(
  items: AggregatedItem[],
  tab: MeTab,
  labels: { resource: string; archivedResource: string; generationRecord: string },
): NormalizedRow[] {
  return items.map((it, idx) => {
    if (tab === 'acquired') {
      const resource = (it as { resource?: { id: string; title: string } }).resource;
      const r = resource || (it as unknown as { id: string; title: string });
      return {
        key: `${(it as { id?: string; resourceId?: string }).id ?? it.resourceId ?? idx}`,
        title: r?.title ?? labels.resource,
        cover: (r as { coverImage?: string | null })?.coverImage ?? null,
        resourceType: it.resourceType,
        resourceId: it.resourceId ?? r?.id,
        category: (r as { category?: string })?.category ?? undefined,
        pointsPaid: it.pointsPaid,
        timestamp: it.acquiredAt,
      };
    }
    if (tab === 'favorites' || tab === 'history') {
      const r = it.resource as
        | { id: string; title: string; coverImage?: string | null; category?: string; pointsCost?: number; useCount?: number }
        | undefined;
      return {
        key: `${(it as { id?: string }).id ?? idx}`,
        title: r?.title ?? labels.archivedResource,
        cover: r?.coverImage ?? null,
        resourceType: it.resourceType,
        resourceId: it.resourceId ?? r?.id,
        category: r?.category,
        pointsCost: r?.pointsCost,
        useCount: r?.useCount,
        timestamp: tab === 'favorites' ? it.createdAt : it.viewedAt,
      };
    }
    if (tab === 'published') {
      return {
        key: `${(it as { id?: string }).id ?? idx}`,
        title: it.title ?? labels.resource,
        cover: it.coverImage,
        resourceType: it.resourceType,
        resourceId: (it as { id?: string }).id,
        category: it.category ?? undefined,
        pointsCost: it.pointsCost,
        useCount: it.useCount,
        status: it.status,
        timestamp: it.updatedAt,
      };
    }
    if (tab === 'generations') {
      const tpl = it.template;
      return {
        key: `${(it as { id?: string }).id ?? idx}`,
        title: tpl?.title ?? labels.generationRecord,
        cover: tpl?.coverImage,
        resourceType: it.generationType,
        resourceId: it.templateId,
        category: tpl?.category ?? undefined,
        timestamp: it.createdAt,
      };
    }
    return { key: `${idx}`, title: '—' };
  });
}

function ResourceTable({
  rows,
  tab,
  onClickRow,
}: {
  rows: NormalizedRow[];
  tab: MeTab;
  onClickRow: (type: ResourceType | undefined, id: string | undefined) => void;
}) {
  const t = useTranslations('profile.resources');
  const tMarketplace = useTranslations('marketplace');

  return (
    <Card className="p-0 gap-0">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead>{t('table.resource')}</TableHead>
            <TableHead>{t('table.type')}</TableHead>
            <TableHead>{t('table.category')}</TableHead>
            {tab === 'acquired' && <TableHead className="text-right">{t('table.pointsSpent')}</TableHead>}
            {tab === 'published' && (
              <>
                <TableHead className="text-right">{t('table.usage')}</TableHead>
                <TableHead>{t('table.status')}</TableHead>
              </>
            )}
            {(tab === 'favorites' || tab === 'history') && (
              <TableHead className="text-right">{t('table.usage')}</TableHead>
            )}
            <TableHead className="text-right">{t('table.time')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const status = row.status ? STATUS_LABEL[row.status] : null;
            return (
              <TableRow
                key={row.key}
                onClick={() => onClickRow(row.resourceType, row.resourceId)}
                className="cursor-pointer"
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded bg-muted">
                      {row.cover && (
                        <img src={row.cover} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-foreground">{row.title}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.resourceType
                    ? tMarketplace(`resourceType.${TYPE_LABEL_KEY[RESOURCE_TYPE_TO_SLUG[row.resourceType]]}`)
                    : '—'}
                </TableCell>
                <TableCell className="text-muted-foreground">{row.category ?? '—'}</TableCell>
                {tab === 'acquired' && (
                  <TableCell className="text-right text-foreground">{row.pointsPaid ?? 0}</TableCell>
                )}
                {tab === 'published' && (
                  <>
                    <TableCell className="text-right text-foreground">
                      {row.useCount ?? 0}
                    </TableCell>
                    <TableCell>
                      {status ? <Badge variant={status.variant}>{t(`status.${status.label}`)}</Badge> : '—'}
                    </TableCell>
                  </>
                )}
                {(tab === 'favorites' || tab === 'history') && (
                  <TableCell className="text-right text-foreground">{row.useCount ?? 0}</TableCell>
                )}
                <TableCell className="text-right text-xs text-muted-foreground">
                  {row.timestamp ? new Date(row.timestamp).toLocaleString() : '—'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

function ProfileStatsBar({
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
