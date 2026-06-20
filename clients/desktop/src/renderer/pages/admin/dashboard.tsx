'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import {
  Users,
  Shield,
  Key,
  TrendingUp,
  Menu,
  Layers,
  Activity,
  Clock3,
  ArrowRight,
  UserPlus,
  ShieldPlus,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Badge } from '@autix/shared-ui/ui';
import {
  useAdminDashboardStatsQuery,
  useAdminRecentUsersQuery,
  useAuthStore,
} from '@autix/shared-store';

const emptySubscribe = () => () => { };
const getClientMounted = () => true;
const getServerMounted = () => false;

function useFormatRelativeTime() {
  const t = useTranslations('dashboard');
  return (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return t('justNow');
    if (diffMins < 60) return t('minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('hoursAgo', { count: diffHours });
    return t('daysAgo', { count: diffDays });
  };
}

function DashboardStatCard({
  label,
  value,
  icon: Icon,
  iconColor,
  trend,
  trendUp = true,
  isLoading,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  iconColor: string;
  trend: string;
  trendUp?: boolean;
  isLoading: boolean;
}) {
  return (
    <div className="border-b px-1 py-5 last:border-b-0" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
            {label}
          </p>
          <div className="mt-3 flex items-end gap-3">
            <div className="text-4xl font-semibold tracking-[-0.04em]" style={{ color: 'var(--foreground)' }}>
              {isLoading ? '—' : value}
            </div>
            <Badge
              variant="secondary"
              className="h-7 rounded-full px-2.5 text-[11px]"
              style={{
                color: trendUp ? 'var(--success)' : 'var(--danger)',
                backgroundColor: trendUp
                  ? 'color-mix(in srgb, var(--success) 10%, transparent)'
                  : 'color-mix(in srgb, var(--danger) 10%, transparent)',
              }}
            >
              {trendUp && <TrendingUp className="mr-1 h-3 w-3" />}
              {trend}
            </Badge>
          </div>
        </div>
        <Icon className="h-4.5 w-4.5" style={{ color: iconColor }} />
      </div>
    </div>
  );
}

function DashboardSection({
  eyebrow,
  title,
  icon: Icon,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  icon: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-lg"
      style={{
        backgroundColor: 'var(--panel)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center justify-between gap-4 border-b px-6 py-5" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <Icon className="h-4.5 w-4.5" style={{ color: 'var(--muted)' }} />
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
              {eyebrow}
            </p>
            <h2 className="mt-1 text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
              {title}
            </h2>
          </div>
        </div>
        {action}
      </div>
      <div className="px-6 py-4">{children}</div>
    </section>
  );
}

export function AdminDashboardPage() {
  const t = useTranslations('dashboard');
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const mounted = useSyncExternalStore(emptySubscribe, getClientMounted, getServerMounted);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const { data: stats, isLoading } = useAdminDashboardStatsQuery();

  const greeting = (() => {
    const hour = currentTime.getHours();
    if (hour < 12) return t('greetingMorning');
    if (hour < 18) return t('greetingAfternoon');
    return t('greetingEvening');
  })();

  const statCards = [
    { label: t('totalUsers'), value: stats?.users ?? 0, icon: Users, iconColor: 'var(--accent)', trend: '+12%' },
    { label: t('roleCount'), value: stats?.roles ?? 0, icon: Shield, iconColor: 'var(--success)', trend: '+2' },
    { label: t('permissionCount'), value: stats?.permissions ?? 0, icon: Key, iconColor: 'var(--warning)', trend: '+8' },
    { label: t('systemCount'), value: stats?.systems ?? 0, icon: Layers, iconColor: 'var(--danger)', trend: t('stable') },
    { label: t('menuCount'), value: stats?.menus ?? 0, icon: Menu, iconColor: 'var(--muted)', trend: '+3' },
  ] as const;

  const quickActions = [
    { icon: UserPlus, label: t('addUser'), description: t('addUserDesc'), path: '/users', iconColor: 'var(--accent)' },
    { icon: ShieldPlus, label: t('addRole'), description: t('addRoleDesc'), path: '/roles', iconColor: 'var(--success)' },
    { icon: Key, label: t('permConfig'), description: t('permConfigDesc'), path: '/permission-center', iconColor: 'var(--warning)' },
  ] as const;

  const systemStatus = [
    { label: t('serviceStatus'), value: t('running'), tone: 'success' as const },
    { label: t('uptime'), value: t('uptimeValue'), tone: 'neutral' as const, icon: Clock3 },
    { label: t('onlineUsers'), value: t('onlineCount', { count: stats?.users ?? 0 }), tone: 'neutral' as const, icon: Users },
    { label: t('systemVersion'), value: 'v2.0.0', tone: 'neutral' as const, icon: Shield },
  ];

  if (!mounted) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div style={{ color: 'var(--muted)' }}>{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
            Admin overview
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]" style={{ color: 'var(--foreground)' }}>
            {greeting}，{user?.realName || user?.username}
          </h1>
        </div>
        <div className="self-start lg:self-auto lg:text-right">
          <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
            Local time
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-[-0.04em]" style={{ color: 'var(--foreground)' }}>
            {currentTime.toLocaleTimeString('zh-CN')}
          </div>
          <div className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            {currentTime.toLocaleDateString('zh-CN', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
          </div>
        </div>
      </div>

      <DashboardSection eyebrow={t('overviewEyebrow')} title={t('keyMetrics')} icon={Layers}>
        <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2 xl:grid-cols-5">
          {statCards.map((stat) => (
            <DashboardStatCard key={stat.label} {...stat} isLoading={isLoading} />
          ))}
        </div>
      </DashboardSection>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <DashboardSection eyebrow={t('actionsEyebrow')} title={t('quickActions')} icon={Sparkles}>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => navigate(action.path)}
                  className="group flex w-full items-center gap-4 py-4 text-left first:pt-0 last:pb-0"
                >
                  <Icon className="h-4.5 w-4.5 flex-shrink-0" style={{ color: action.iconColor }} />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                      {action.label}
                    </h3>
                    <p className="mt-1 text-sm leading-6" style={{ color: 'var(--muted)' }}>
                      {action.description}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 opacity-40 transition-opacity group-hover:opacity-100" style={{ color: 'var(--muted)' }} />
                </button>
              );
            })}
          </div>
        </DashboardSection>

        <DashboardSection eyebrow={t('statusEyebrow')} title={t('systemStatusTitle')} icon={Activity}>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {systemStatus.map((item) => {
              const Icon = item.icon;
              const successTone = item.tone === 'success';

              return (
                <div key={item.label} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    {successTone ? (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: 'color-mix(in srgb, var(--success) 14%, transparent)' }}>
                        <div className="h-2.5 w-2.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--success)' }} />
                      </div>
                    ) : Icon ? (
                      <Icon className="h-4 w-4" style={{ color: 'var(--muted)' }} />
                    ) : null}
                    <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {item.label}
                    </p>
                  </div>
                  <span className="text-sm font-medium" style={{ color: successTone ? 'var(--success)' : 'var(--muted)' }}>
                    {item.value}
                  </span>
                </div>
              );
            })}
          </div>
        </DashboardSection>
      </div>

      <RecentActivitySection />
    </div>
  );
}

function RecentActivitySection() {
  const t = useTranslations('dashboard');
  const navigate = useNavigate();
  const formatRelativeTime = useFormatRelativeTime();
  const { data: recentUsers = [], isLoading } = useAdminRecentUsersQuery();

  return (
    <DashboardSection
      eyebrow={t('recentActivityEyebrow')}
      title={t('recentActivity')}
      icon={Clock3}
      action={
        <Button
          variant="ghost"
          size="sm"
          className="h-9 rounded-full px-3"
          style={{ color: 'var(--foreground)' }}
          onClick={() => navigate('/users')}
        >
          {t('viewAll')}
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      }
    >
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-[68px] animate-pulse border-b last:border-b-0" style={{ borderColor: 'var(--border)', backgroundColor: 'color-mix(in srgb, var(--panel-muted) 55%, transparent)' }} />
          ))}
        </div>
      ) : recentUsers.length === 0 ? (
        <div className="flex min-h-32 items-center justify-center text-sm" style={{ color: 'var(--muted)' }}>
          {t('noActivity')}
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {recentUsers.map((user) => {
            const displayName = user.realName || user.username;
            return (
              <div key={`${user.username}-${user.createdAt}`} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                <UserPlus className="h-4.5 w-4.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-6" style={{ color: 'var(--foreground)' }}>
                    <span className="font-medium">{displayName}</span>
                    {' '}{t('userCreated')}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                    {formatRelativeTime(user.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardSection>
  );
}
