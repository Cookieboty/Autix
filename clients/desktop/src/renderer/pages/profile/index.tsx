'use client';

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Sparkles, Star, Clock, Upload, Bookmark, Crown, Coins, Package, ShoppingBag, Gift, Copy, Check, Share2, BookOpen, Settings } from 'lucide-react';
import { Button } from '@heroui/react';
import { meApi, marketplaceApi, membershipApi, inviteApi, type MeTab, type MembershipInfo, type InviteCode } from '@autix/shared-lib';
import { useAuthStore } from '@autix/shared-store';

type ProfileTabKey = MeTab | 'membership' | 'library' | 'models';

const TABS: { key: ProfileTabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'acquired', label: '我的资源', icon: <Sparkles className="w-3.5 h-3.5" /> },
  { key: 'favorites', label: '我的收藏', icon: <Star className="w-3.5 h-3.5" /> },
  { key: 'generations', label: '生成历史', icon: <Clock className="w-3.5 h-3.5" /> },
  { key: 'published', label: '我的发布', icon: <Upload className="w-3.5 h-3.5" /> },
  { key: 'history', label: '浏览历史', icon: <Bookmark className="w-3.5 h-3.5" /> },
  { key: 'library', label: '资料库', icon: <BookOpen className="w-3.5 h-3.5" /> },
  { key: 'models', label: '模型配置', icon: <Settings className="w-3.5 h-3.5" /> },
  { key: 'membership', label: '会员中心', icon: <Crown className="w-3.5 h-3.5" /> },
];

const TYPE_TO_SLUG: Record<string, string> = {
  SKILL: 'skills',
  MCP: 'mcp',
  AGENT: 'agents',
  IMAGE_TEMPLATE: 'image-templates',
  VIDEO_TEMPLATE: 'video-templates',
};

export function ProfilePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);

  const initialTab = (searchParams.get('tab') as ProfileTabKey) || 'acquired';
  const [tab, setTab] = useState<ProfileTabKey>(initialTab);
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{
    totalResources: number;
    totalAcquisitions: number;
  } | null>(null);
  const resourceTab = isResourceTab(tab) ? tab : null;

  useEffect(() => {
    if (!resourceTab) return;
    let cancelled = false;
    setLoading(true);
    meApi
      .resources(resourceTab, { page: 1, pageSize: 30 })
      .then((res) => {
        if (cancelled) return;
        const data = res.data as { items: Record<string, unknown>[] };
        setItems(data.items ?? []);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [resourceTab]);

  useEffect(() => {
    marketplaceApi.platformStats().then((res) => {
      setStats(
        res.data as { totalResources: number; totalAcquisitions: number },
      );
    });
  }, []);

  const totalPointsSpent = useMemo(() => {
    if (resourceTab !== 'acquired') return null;
    return items.reduce(
      (sum, it) => sum + ((it as { pointsPaid?: number }).pointsPaid ?? 0),
      0,
    );
  }, [items, resourceTab]);

  const nickname = user?.realName || user?.username || '未登录';

  const onClickRow = (
    resourceType: string | undefined,
    resourceId: string | undefined,
  ) => {
    if (!resourceType || !resourceId) return;
    const slug = TYPE_TO_SLUG[resourceType];
    if (slug) navigate(`/marketplace/${slug}/${resourceId}`);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ProfileTopBar />
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div
          className="flex items-center gap-4 p-5 rounded-lg"
          style={{
            backgroundColor: 'var(--panel)',
            border: '1px solid var(--border)',
          }}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-semibold flex-shrink-0"
            style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
          >
            {(nickname[0] || '?').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="text-base font-semibold"
              style={{ color: 'var(--foreground)' }}
            >
              {nickname}
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              {user?.email ?? '—'}
            </div>
          </div>
        </div>

        <div
          className="mt-6 flex items-center gap-2 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => {
                  setTab(t.key);
                  setSearchParams({ tab: t.key });
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-sm transition-colors"
                style={{
                  color: active ? 'var(--accent)' : 'var(--muted)',
                  borderBottom: active
                    ? '2px solid var(--accent)'
                    : '2px solid transparent',
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
              onAction={() => navigate('/library')}
            />
          ) : tab === 'models' ? (
            <ProfileFeaturePanel
              icon={<Settings className="w-5 h-5" />}
              title="模型配置"
              description="管理模型、API Key、能力标签与默认模型选择。"
              actionLabel="进入模型配置"
              onAction={() => navigate('/models')}
            />
          ) : loading ? (
            <div
              className="text-center py-16 text-sm"
              style={{ color: 'var(--muted)' }}
            >
              加载中…
            </div>
          ) : items.length === 0 ? (
            <div
              className="text-center py-16 text-sm"
              style={{ color: 'var(--muted)' }}
            >
              暂无内容
            </div>
          ) : (
            <ul className="space-y-2">
              {items.map((it, idx) => {
                const r =
                  ((it as { resource?: Record<string, unknown> }).resource as
                    | Record<string, unknown>
                    | undefined) ?? it;
                const title =
                  (r as { title?: string }).title ??
                  ((it as { template?: { title?: string } }).template?.title) ??
                  '资源';
                const type =
                  (it as { resourceType?: string }).resourceType ??
                  (it as { generationType?: string }).generationType;
                const id =
                  (it as { resourceId?: string }).resourceId ??
                  (it as { templateId?: string }).templateId ??
                  (r as { id?: string }).id;
                return (
                  <li
                    key={`${idx}-${id ?? ''}`}
                    onClick={() => onClickRow(type, id)}
                    className="flex items-center gap-3 px-3 py-2 rounded cursor-pointer hover:bg-[var(--panel-muted)]"
                    style={{
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--panel)',
                    }}
                  >
                    <div
                      className="flex-1 truncate"
                      style={{ color: 'var(--foreground)' }}
                    >
                      {title}
                    </div>
                    {type && (
                      <span
                        className="text-xs"
                        style={{ color: 'var(--muted)' }}
                      >
                        {type}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div
          className="mt-6 p-4 rounded-lg flex items-center gap-8 text-sm"
          style={{
            backgroundColor: 'var(--panel)',
            border: '1px solid var(--border)',
          }}
        >
          <Stat label="已消耗积分" value={totalPointsSpent ?? '—'} />
          <Stat label="平台总资源" value={stats?.totalResources ?? '—'} />
          <Stat label="平台总获取" value={stats?.totalAcquisitions ?? '—'} />
        </div>
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

const membershipActions = [
  { label: '升级会员', icon: Crown, href: '/membership/upgrade' },
  { label: '积分流水', icon: Coins, href: '/membership/points' },
  { label: '积分加油包', icon: Package, href: '/membership/packages' },
  { label: '我的订单', icon: ShoppingBag, href: '/membership/orders' },
  { label: '邀请好友', icon: Gift, href: '/membership/invite' },
] as const;

function MembershipPanel() {
  const navigate = useNavigate();
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
            onClick={() => navigate(href)}
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
            <Button size="sm" variant="ghost" className="cursor-pointer flex-shrink-0" onPress={handleCopyLink}>
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
        <Button variant="primary" className="flex-shrink-0 cursor-pointer" onPress={onAction}>
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-xs" style={{ color: 'var(--muted)' }}>
        {label}
      </div>
      <div
        className="font-semibold mt-1"
        style={{ color: 'var(--foreground)' }}
      >
        {value}
      </div>
    </div>
  );
}
