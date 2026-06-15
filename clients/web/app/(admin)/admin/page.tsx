'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  Gift,
  ShieldPlus,
  Sparkles,
  ScrollText,
  type LucideIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button, Badge } from '@autix/shared-ui/ui';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';

interface Stats {
  users: number;
  roles: number;
  permissions: number;
  systems: number;
  menus: number;
}

interface CountListResponse {
  list?: unknown[];
  length?: number;
}

interface PaginatedCountResponse {
  pagination?: {
    total?: number;
  };
  total?: number;
}

interface RecentUser {
  realName?: string;
  username: string;
  createdAt: string;
}

const emptySubscribe = () => () => { };
const getClientMounted = () => true;
const getServerMounted = () => false;

function readListCount(data: CountListResponse | unknown): number {
  if (!data || typeof data !== 'object') return 0;
  if ('list' in data && Array.isArray(data.list)) return data.list.length;
  if ('length' in data && typeof data.length === 'number') return data.length;
  return 0;
}

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
  trend,
  trendUp = true,
  isLoading,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  trend: string;
  trendUp?: boolean;
  isLoading: boolean;
}) {
  return (
    <div className="border-border border-b px-1 py-5 last:border-b-0">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
            {label}
          </p>
          <div className="mt-3 flex items-end gap-3">
            <div className="text-foreground text-4xl font-semibold tracking-[-0.04em]">
              {isLoading ? '—' : value}
            </div>
            <Badge variant={trendUp ? 'secondary' : 'destructive'} className="h-7 rounded-full px-2.5 text-[11px]">
              {trendUp && <TrendingUp className="mr-1 h-3 w-3" />}
              {trend}
            </Badge>
          </div>
        </div>
        <Icon className="text-muted-foreground h-4.5 w-4.5" />
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
    <section className="bg-card border-border rounded-lg border">
      <div className="border-border flex items-center justify-between gap-4 border-b px-6 py-5">
        <div className="flex items-center gap-3">
          <Icon className="text-muted-foreground h-4.5 w-4.5" />
          <div>
            <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
              {eyebrow}
            </p>
            <h2 className="text-foreground mt-1 text-lg font-semibold">
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

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const router = useRouter();
  const { user } = useAuthStore();
  const mounted = useSyncExternalStore(emptySubscribe, getClientMounted, getServerMounted);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [users, roles, permissions, systems, menus] = await Promise.all([
        api.get<PaginatedCountResponse>('/users').then((res) => res.data.pagination?.total ?? res.data.total ?? 0),
        api.get<CountListResponse>('/roles').then((res) => readListCount(res.data)),
        api.get<CountListResponse>('/permissions').then((res) => readListCount(res.data)),
        api.get<CountListResponse>('/systems').then((res) => readListCount(res.data)),
        api.get<CountListResponse>('/menus').then((res) => readListCount(res.data)),
      ]);

      return { users, roles, permissions, systems, menus };
    },
  });

  const greeting = (() => {
    const hour = currentTime.getHours();
    if (hour < 12) return t('greetingMorning');
    if (hour < 18) return t('greetingAfternoon');
    return t('greetingEvening');
  })();

  const statCards = [
    { label: t('totalUsers'), value: stats?.users ?? 0, icon: Users, trend: '+12%' },
    { label: t('roleCount'), value: stats?.roles ?? 0, icon: Shield, trend: '+2' },
    { label: t('permissionCount'), value: stats?.permissions ?? 0, icon: Key, trend: '+8' },
    { label: t('systemCount'), value: stats?.systems ?? 0, icon: Layers, trend: t('stable') },
    { label: t('menuCount'), value: stats?.menus ?? 0, icon: Menu, trend: '+3' },
  ] as const;

  const quickActions = [
    { icon: UserPlus, label: t('addUser'), description: t('addUserDesc'), path: '/admin/users' },
    { icon: ShieldPlus, label: t('addRole'), description: t('addRoleDesc'), path: '/admin/roles' },
    { icon: Key, label: t('permConfig'), description: t('permConfigDesc'), path: '/admin/permission-center' },
    { icon: Gift, label: '活动奖励', description: '配置奖励活动、预算和发放记录', path: '/admin/campaigns' },
    { icon: ScrollText, label: t('auditLogsAction'), description: t('auditLogsActionDesc'), path: '/admin/audit-logs' },
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
        <div className="text-muted-foreground">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
            Admin overview
          </p>
          <h1 className="text-foreground mt-2 text-3xl font-semibold tracking-[-0.04em]">
            {greeting}，{user?.realName || user?.username}
          </h1>
        </div>
        <div className="self-start lg:self-auto lg:text-right">
          <div className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
            Local time
          </div>
          <div className="text-foreground mt-2 text-2xl font-semibold tracking-[-0.04em]">
            {currentTime.toLocaleTimeString('zh-CN')}
          </div>
          <div className="text-muted-foreground mt-1 text-sm">
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
          <div className="divide-border divide-y">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => router.push(action.path)}
                  className="hover:bg-accent/40 group -mx-2 flex w-full items-center gap-4 rounded-md px-2 py-4 text-left transition-colors first:pt-0 last:pb-0"
                >
                  <Icon className="text-muted-foreground h-4.5 w-4.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-foreground text-sm font-semibold">
                      {action.label}
                    </h3>
                    <p className="text-muted-foreground mt-1 text-sm leading-6">
                      {action.description}
                    </p>
                  </div>
                  <ArrowRight className="text-muted-foreground h-4 w-4 opacity-40 transition-opacity group-hover:opacity-100" />
                </button>
              );
            })}
          </div>
        </DashboardSection>

        <DashboardSection eyebrow={t('statusEyebrow')} title={t('systemStatusTitle')} icon={Activity}>
          <div className="divide-border divide-y">
            {systemStatus.map((item) => {
              const Icon = item.icon;
              const successTone = item.tone === 'success';

              return (
                <div key={item.label} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    {successTone ? (
                      <div className="bg-secondary flex h-8 w-8 items-center justify-center rounded-full">
                        <div className="bg-primary h-2.5 w-2.5 animate-pulse rounded-full" />
                      </div>
                    ) : Icon ? (
                      <Icon className="text-muted-foreground h-4 w-4" />
                    ) : null}
                    <p className="text-foreground text-sm font-medium">
                      {item.label}
                    </p>
                  </div>
                  <span className={`text-sm font-medium ${successTone ? 'text-foreground' : 'text-muted-foreground'}`}>
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
  const router = useRouter();
  const formatRelativeTime = useFormatRelativeTime();
  const { data: recentUsers = [], isLoading } = useQuery<RecentUser[]>({
    queryKey: ['recent-users'],
    queryFn: async () => {
      const res = await api.get<{ list?: RecentUser[]; data?: RecentUser[] }>('/users?page=1&pageSize=5&sortBy=createdAt&sortOrder=desc');
      return res.data.data ?? res.data.list ?? [];
    },
  });

  return (
    <DashboardSection
      eyebrow={t('recentActivityEyebrow')}
      title={t('recentActivity')}
      icon={Clock3}
      action={
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin/users')}>
          {t('viewAll')}
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      }
    >
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="bg-secondary/55 border-border h-[68px] animate-pulse border-b last:border-b-0" />
          ))}
        </div>
      ) : recentUsers.length === 0 ? (
        <div className="text-muted-foreground flex min-h-32 items-center justify-center text-sm">
          {t('noActivity')}
        </div>
      ) : (
        <div className="divide-border divide-y">
          {recentUsers.map((user) => {
            const displayName = user.realName || user.username;
            return (
              <div key={`${user.username}-${user.createdAt}`} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                <UserPlus className="text-muted-foreground h-4.5 w-4.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-foreground text-sm leading-6">
                    <span className="font-medium">{displayName}</span>
                    {' '}{t('userCreated')}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
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
