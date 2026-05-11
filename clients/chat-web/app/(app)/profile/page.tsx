'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  CardTitle,
  SidebarTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@autix/shared-ui';
import {
  meApi,
  marketplaceApi,
  membershipApi,
  inviteApi,
  type MeTab,
  type ResourceType,
  type MembershipInfo,
  type InviteCode,
} from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { TYPE_TO_SLUG } from '@/lib/resource-types';

type ProfileTabKey = MeTab | 'membership' | 'library' | 'models';

interface ProfileTab {
  key: ProfileTabKey;
  label: string;
  icon: React.ReactNode;
}

const TABS: ProfileTab[] = [
  { key: 'acquired', label: '我的资源', icon: <Sparkles className="h-3.5 w-3.5" /> },
  { key: 'favorites', label: '我的收藏', icon: <Star className="h-3.5 w-3.5" /> },
  { key: 'generations', label: '生成历史', icon: <Clock className="h-3.5 w-3.5" /> },
  { key: 'published', label: '我的发布', icon: <Upload className="h-3.5 w-3.5" /> },
  { key: 'history', label: '浏览历史', icon: <Bookmark className="h-3.5 w-3.5" /> },
  { key: 'library', label: '资料库', icon: <BookOpen className="h-3.5 w-3.5" /> },
  { key: 'models', label: '模型配置', icon: <Settings className="h-3.5 w-3.5" /> },
  { key: 'membership', label: '会员中心', icon: <Crown className="h-3.5 w-3.5" /> },
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
  PENDING: { label: '待审核', variant: 'secondary' },
  IN_REVIEW: { label: '审核中', variant: 'secondary' },
  APPROVED: { label: '已上架', variant: 'default' },
  REJECTED: { label: '已驳回', variant: 'destructive' },
  ARCHIVED: { label: '已下架', variant: 'outline' },
};

export default function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((s) => s.user);

  const initialTab = (searchParams?.get('tab') as ProfileTabKey) || 'acquired';
  const [tab, setTab] = useState<ProfileTabKey>(initialTab);
  const [items, setItems] = useState<AggregatedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const resourceTab = isResourceTab(tab) ? tab : null;

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

  const rows = useMemo(
    () => (resourceTab ? normalizeRows(items, resourceTab) : []),
    [items, resourceTab],
  );

  const goDetail = (resourceType: ResourceType | undefined, resourceId: string | undefined) => {
    if (!resourceType || !resourceId) return;
    const slug = TYPE_TO_SLUG[resourceType];
    if (!slug) return;
    router.push(`/marketplace/${slug}/${resourceId}`);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ProfileTopBar />
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <UserHeader user={user} stats={stats} />

        <div className="mt-6 flex items-center gap-1 border-b border-border overflow-x-auto">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => {
                  setTab(t.key);
                  const url = new URL(window.location.href);
                  url.searchParams.set('tab', t.key);
                  window.history.replaceState({}, '', url.toString());
                }}
                className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors -mb-px ${
                  active
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.icon} {t.label}
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
              title="资料库"
              description="管理文档、知识库与可检索资料，让 Chat 可以基于你的资料进行回答。"
              actionLabel="进入资料库"
              onAction={() => router.push('/library')}
            />
          ) : tab === 'models' ? (
            <ProfileFeaturePanel
              icon={<Settings className="h-5 w-5" />}
              title="模型配置"
              description="管理模型、API Key、能力标签与默认模型选择。"
              actionLabel="进入模型配置"
              onAction={() => router.push('/models')}
            />
          ) : loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">加载中…</div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">暂无内容</div>
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
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
      <SidebarTrigger className="-ml-1" />
      <h1 className="ml-1 text-sm font-semibold text-foreground">个人中心</h1>
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
  const nickname = user?.realName || user?.username || '未登录';
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
          <Stat label="发布资源" value={stats?.totalResources ?? 0} />
          <Stat label="平台收藏" value={stats?.totalAcquisitions ?? 0} />
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
  { label: '升级会员', icon: Crown, href: '/membership/upgrade' },
  { label: '积分流水', icon: Coins, href: '/membership/points' },
  { label: '积分加油包', icon: Package, href: '/membership/packages' },
  { label: '我的订单', icon: ShoppingBag, href: '/membership/orders' },
  { label: '邀请好友', icon: Gift, href: '/membership/invite' },
] as const;

function MembershipPanel() {
  const router = useRouter();
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
    return <div className="py-16 text-center text-sm text-muted-foreground">加载中…</div>;
  }

  const membership = info?.membership;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="当前等级" value={membership?.level.name ?? '未开通'} />
            <Stat label="积分余额" value={info?.pointsBalance ?? 0} />
            <Stat
              label="到期时间"
              value={membership ? new Date(membership.expiresAt).toLocaleDateString() : '—'}
            />
            <Stat
              label="自动续费"
              value={membership ? (membership.autoRenew ? '已开启' : '未开启') : '—'}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {membershipActions.map(({ label, icon: Icon, href }) => (
          <Card
            key={href}
            size="sm"
            className="cursor-pointer transition-colors hover:bg-muted"
            onClick={() => router.push(href)}
          >
            <CardContent className="flex flex-col items-center gap-2.5 py-2">
              <Icon className="h-5 w-5 text-primary" />
              <span className="text-xs font-medium text-foreground">{label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {inviteCode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Share2 className="h-4 w-4 text-primary" />
              邀请推广
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
                <span className="ml-1 text-xs">{copied ? '已复制' : '复制链接'}</span>
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

function normalizeRows(items: AggregatedItem[], tab: MeTab): NormalizedRow[] {
  return items.map((it, idx) => {
    if (tab === 'acquired') {
      const resource = (it as { resource?: { id: string; title: string } }).resource;
      const r = resource || (it as unknown as { id: string; title: string });
      return {
        key: `${(it as { id?: string; resourceId?: string }).id ?? it.resourceId ?? idx}`,
        title: r?.title ?? '资源',
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
        title: r?.title ?? '已下架资源',
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
        title: it.title ?? '资源',
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
        title: tpl?.title ?? '生成记录',
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
  return (
    <Card className="p-0 gap-0">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead>资源</TableHead>
            <TableHead>类型</TableHead>
            <TableHead>分类</TableHead>
            {tab === 'acquired' && <TableHead className="text-right">消耗积分</TableHead>}
            {tab === 'published' && (
              <>
                <TableHead className="text-right">使用量</TableHead>
                <TableHead>状态</TableHead>
              </>
            )}
            {(tab === 'favorites' || tab === 'history') && (
              <TableHead className="text-right">使用量</TableHead>
            )}
            <TableHead className="text-right">时间</TableHead>
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
                  {row.resourceType ? labelOfType(row.resourceType) : '—'}
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
                      {status ? <Badge variant={status.variant}>{status.label}</Badge> : '—'}
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

function labelOfType(t: ResourceType): string {
  switch (t) {
    case 'SKILL':
      return 'Skill';
    case 'MCP':
      return 'MCP';
    case 'AGENT':
      return 'Agent';
    case 'IMAGE_TEMPLATE':
      return '图片模板';
    case 'VIDEO_TEMPLATE':
      return '视频模板';
    default:
      return t;
  }
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
  return (
    <Card className="mt-6">
      <CardContent className="flex flex-wrap items-center gap-8 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">已发布资源</div>
          <div className="mt-1 font-semibold text-foreground">{publishedCount ?? '—'}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">已消耗积分</div>
          <div className="mt-1 font-semibold text-foreground">{totalPointsSpent ?? '—'}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">平台总资源</div>
          <div className="mt-1 font-semibold text-foreground">{stats?.totalResources ?? '—'}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">平台总获取</div>
          <div className="mt-1 font-semibold text-foreground">{stats?.totalAcquisitions ?? '—'}</div>
        </div>
      </CardContent>
    </Card>
  );
}
