'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sparkles, Star, Clock, Upload, Bookmark, Crown, Coins, Package, ShoppingBag, Gift, Copy, Check, Share2, BookOpen, Settings } from 'lucide-react';
import { Button } from '@autix/shared-ui';
import { meApi, marketplaceApi, membershipApi, inviteApi, type MeTab, type ResourceType, type MembershipInfo, type InviteCode } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { TYPE_TO_SLUG } from '@/lib/resource-types';

type ProfileTabKey = MeTab | 'membership' | 'library' | 'models';

interface ProfileTab {
  key: ProfileTabKey;
  label: string;
  icon: React.ReactNode;
}

const TABS: ProfileTab[] = [
  { key: 'acquired', label: '我的资源', icon: <Sparkles className="w-3.5 h-3.5" /> },
  { key: 'favorites', label: '我的收藏', icon: <Star className="w-3.5 h-3.5" /> },
  { key: 'generations', label: '生成历史', icon: <Clock className="w-3.5 h-3.5" /> },
  { key: 'published', label: '我的发布', icon: <Upload className="w-3.5 h-3.5" /> },
  { key: 'history', label: '浏览历史', icon: <Bookmark className="w-3.5 h-3.5" /> },
  { key: 'library', label: '资料库', icon: <BookOpen className="w-3.5 h-3.5" /> },
  { key: 'models', label: '模型配置', icon: <Settings className="w-3.5 h-3.5" /> },
  { key: 'membership', label: '会员中心', icon: <Crown className="w-3.5 h-3.5" /> },
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

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDING: { label: '待审核', color: '#f59e0b' },
  IN_REVIEW: { label: '审核中', color: '#3b82f6' },
  APPROVED: { label: '已上架', color: '#22c55e' },
  REJECTED: { label: '已驳回', color: '#ef4444' },
  ARCHIVED: { label: '已下架', color: '#6b7280' },
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
    <div className="flex flex-col h-full overflow-hidden">
      <ProfileTopBar />
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <UserHeader user={user} stats={stats} />

        <div className="mt-6 flex items-center gap-2 border-b" style={{ borderColor: 'var(--border)' }}>
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
                className="flex items-center gap-1.5 px-3 py-2 text-sm transition-colors"
                style={{
                  color: active ? 'var(--accent)' : 'var(--muted)',
                  borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                  marginBottom: '-1px',
                }}
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
              icon={<BookOpen className="w-5 h-5" />}
              title="资料库"
              description="管理文档、知识库与可检索资料，让 Chat 可以基于你的资料进行回答。"
              actionLabel="进入资料库"
              onAction={() => router.push('/library')}
            />
          ) : tab === 'models' ? (
            <ProfileFeaturePanel
              icon={<Settings className="w-5 h-5" />}
              title="模型配置"
              description="管理模型、API Key、能力标签与默认模型选择。"
              actionLabel="进入模型配置"
              onAction={() => router.push('/models')}
            />
          ) : loading ? (
            <div className="text-center py-16 text-sm" style={{ color: 'var(--muted)' }}>
              加载中…
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-16 text-sm" style={{ color: 'var(--muted)' }}>
              暂无内容
            </div>
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
    <div
      className="flex-shrink-0 h-14 px-6 flex items-center justify-between"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <div>
        <h1 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          个人中心
        </h1>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>
          管理资源、会员、积分与发布记录
        </p>
      </div>
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
  return (
    <div className="flex items-center gap-4 p-5 rounded-lg" style={{ backgroundColor: 'var(--panel)', border: '1px solid var(--border)' }}>
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-semibold flex-shrink-0"
        style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
      >
        {user?.avatar ? (
          <img src={user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
        ) : (
          (nickname[0] || '?').toUpperCase()
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
          {nickname}
        </div>
        <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
          {user?.email ?? '—'}
        </div>
      </div>
      <div className="flex items-center gap-6 text-center text-xs" style={{ color: 'var(--muted)' }}>
        <Stat label="发布资源" value={stats?.totalResources ?? 0} />
        <Stat label="平台收藏" value={stats?.totalAcquisitions ?? 0} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
        {value}
      </div>
      <div className="mt-0.5">{label}</div>
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
      inviteApi.getCode().then((res) => setInviteCode(res.data)).catch(() => {}),
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
    return (
      <div className="text-center py-16 text-sm" style={{ color: 'var(--muted)' }}>
        加载中…
      </div>
    );
  }

  const membership = info?.membership;

  return (
    <div className="space-y-4">
      <div
        className="rounded-lg p-5"
        style={{ backgroundColor: 'var(--panel)', border: '1px solid var(--border)' }}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Stat label="当前等级" value={membership?.level.name ?? '未开通'} />
          <Stat label="积分余额" value={info?.pointsBalance ?? 0} />
          <Stat label="到期时间" value={membership ? new Date(membership.expiresAt).toLocaleDateString() : '—'} />
          <Stat label="自动续费" value={membership ? (membership.autoRenew ? '已开启' : '未开启') : '—'} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {membershipActions.map(({ label, icon: Icon, href }) => (
          <button
            key={href}
            onClick={() => router.push(href)}
            className="flex flex-col items-center gap-2.5 p-5 rounded-lg transition-colors cursor-pointer"
            style={{ backgroundColor: 'var(--panel)', border: '1px solid var(--border)' }}
          >
            <Icon className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
              {label}
            </span>
          </button>
        ))}
      </div>

      {inviteCode && (
        <div
          className="rounded-lg p-5"
          style={{ backgroundColor: 'var(--panel)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Share2 className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              邀请推广
            </h2>
          </div>
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)' }}
          >
            <span className="flex-1 text-xs font-mono truncate" style={{ color: 'var(--foreground)' }}>
              {inviteLink}
            </span>
            <Button size="sm" variant="ghost" className="cursor-pointer flex-shrink-0" onClick={handleCopyLink}>
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="ml-1 text-xs">{copied ? '已复制' : '复制链接'}</span>
            </Button>
          </div>
        </div>
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
    <div
      className="rounded-lg p-5"
      style={{ backgroundColor: 'var(--panel)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: 'var(--panel-muted)', color: 'var(--accent)' }}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            {title}
          </h2>
          <p className="mt-1 text-sm leading-6" style={{ color: 'var(--muted)' }}>
            {description}
          </p>
        </div>
        <Button  className="flex-shrink-0 cursor-pointer" onClick={onAction}>
          {actionLabel}
        </Button>
      </div>
    </div>
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
      const r = it.resource as { id: string; title: string; coverImage?: string | null; category?: string; pointsCost?: number; useCount?: number } | undefined;
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
    <div
      className="overflow-hidden rounded-lg"
      style={{ border: '1px solid var(--border)', backgroundColor: 'var(--panel)' }}
    >
      <table className="w-full text-sm">
        <thead style={{ backgroundColor: 'var(--panel-muted)', color: 'var(--muted)' }}>
          <tr>
            <th className="text-left px-4 py-2.5 font-medium">资源</th>
            <th className="text-left px-4 py-2.5 font-medium">类型</th>
            <th className="text-left px-4 py-2.5 font-medium">分类</th>
            {tab === 'acquired' && (
              <th className="text-right px-4 py-2.5 font-medium">消耗积分</th>
            )}
            {tab === 'published' && (
              <>
                <th className="text-right px-4 py-2.5 font-medium">使用量</th>
                <th className="text-left px-4 py-2.5 font-medium">状态</th>
              </>
            )}
            {(tab === 'favorites' || tab === 'history') && (
              <th className="text-right px-4 py-2.5 font-medium">使用量</th>
            )}
            <th className="text-right px-4 py-2.5 font-medium">时间</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const status = row.status ? STATUS_LABEL[row.status] : null;
            return (
              <tr
                key={row.key}
                onClick={() => onClickRow(row.resourceType, row.resourceId)}
                className="cursor-pointer transition-colors hover:bg-[var(--panel-muted)]"
                style={{ borderTop: '1px solid var(--border)' }}
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded flex-shrink-0 overflow-hidden"
                      style={{ backgroundColor: 'var(--panel-muted)' }}
                    >
                      {row.cover && (
                        <img
                          src={row.cover}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div
                        className="truncate font-medium"
                        style={{ color: 'var(--foreground)' }}
                      >
                        {row.title}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5" style={{ color: 'var(--muted)' }}>
                  {row.resourceType ? labelOfType(row.resourceType) : '—'}
                </td>
                <td className="px-4 py-2.5" style={{ color: 'var(--muted)' }}>
                  {row.category ?? '—'}
                </td>
                {tab === 'acquired' && (
                  <td className="px-4 py-2.5 text-right" style={{ color: 'var(--foreground)' }}>
                    {row.pointsPaid ?? 0}
                  </td>
                )}
                {tab === 'published' && (
                  <>
                    <td className="px-4 py-2.5 text-right" style={{ color: 'var(--foreground)' }}>
                      {row.useCount ?? 0}
                    </td>
                    <td className="px-4 py-2.5">
                      {status ? (
                        <span
                          className="px-2 py-0.5 rounded-full text-xs"
                          style={{ backgroundColor: status.color + '20', color: status.color }}
                        >
                          {status.label}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </>
                )}
                {(tab === 'favorites' || tab === 'history') && (
                  <td className="px-4 py-2.5 text-right" style={{ color: 'var(--foreground)' }}>
                    {row.useCount ?? 0}
                  </td>
                )}
                <td
                  className="px-4 py-2.5 text-right text-xs"
                  style={{ color: 'var(--muted)' }}
                >
                  {row.timestamp ? new Date(row.timestamp).toLocaleString() : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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
    <div
      className="mt-6 p-4 rounded-lg flex items-center gap-8 text-sm"
      style={{ backgroundColor: 'var(--panel)', border: '1px solid var(--border)' }}
    >
      <div>
        <div className="text-xs" style={{ color: 'var(--muted)' }}>
          已发布资源
        </div>
        <div className="font-semibold mt-1" style={{ color: 'var(--foreground)' }}>
          {publishedCount ?? '—'}
        </div>
      </div>
      <div>
        <div className="text-xs" style={{ color: 'var(--muted)' }}>
          已消耗积分
        </div>
        <div className="font-semibold mt-1" style={{ color: 'var(--foreground)' }}>
          {totalPointsSpent ?? '—'}
        </div>
      </div>
      <div>
        <div className="text-xs" style={{ color: 'var(--muted)' }}>
          平台总资源
        </div>
        <div className="font-semibold mt-1" style={{ color: 'var(--foreground)' }}>
          {stats?.totalResources ?? '—'}
        </div>
      </div>
      <div>
        <div className="text-xs" style={{ color: 'var(--muted)' }}>
          平台总获取
        </div>
        <div className="font-semibold mt-1" style={{ color: 'var(--foreground)' }}>
          {stats?.totalAcquisitions ?? '—'}
        </div>
      </div>
    </div>
  );
}
