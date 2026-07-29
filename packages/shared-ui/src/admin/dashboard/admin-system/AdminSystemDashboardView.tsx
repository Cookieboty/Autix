'use client';

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowRight,
  Clock3,
  Key,
  Layers,
  Menu,
  ScrollText,
  Shield,
  ShieldPlus,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import {
  useAdminDashboardStatsQuery,
  useAdminRecentUsersQuery,
  useAuthStore,
} from '@autix/shared-store';
import { Button } from '../../../ui/button';
import { RouteLoader } from '../../../ui/route-loader';

const emptySubscribe = () => () => {};

export interface AdminSystemDashboardViewProps {
  onNavigate: (path: string) => void;
}

function Section({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="bg-card border-border rounded-xl border">
      <div className="border-border flex items-center justify-between border-b px-6 py-5">
        <div className="flex items-center gap-3">
          <Icon className="text-muted-foreground h-4 w-4" />
          <h2 className="text-foreground text-lg font-semibold">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

export function AdminSystemDashboardView({ onNavigate }: AdminSystemDashboardViewProps) {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const user = useAuthStore((state) => state.user);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [now, setNow] = useState(() => new Date());
  const statsQuery = useAdminDashboardStatsQuery();
  const greeting = t(now.getHours() < 12 ? 'greetingMorning' : now.getHours() < 18 ? 'greetingAfternoon' : 'greetingEvening');
  const displayName = user?.realName || user?.username || '';

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!mounted) {
    return <RouteLoader className="h-96 min-h-0" label={t('loading')} />;
  }

  const stats = [
    { label: t('totalUsers'), value: statsQuery.data?.users, icon: Users },
    { label: t('roleCount'), value: statsQuery.data?.roles, icon: Shield },
    { label: t('permissionCount'), value: statsQuery.data?.permissions, icon: Key },
    { label: t('systemCount'), value: statsQuery.data?.systems, icon: Layers },
    { label: t('menuCount'), value: statsQuery.data?.menus, icon: Menu },
  ];
  const actions = [
    { label: t('addUser'), description: t('addUserDesc'), path: '/admin/users', icon: UserPlus },
    { label: t('addRole'), description: t('addRoleDesc'), path: '/admin/roles', icon: ShieldPlus },
    { label: t('permConfig'), description: t('permConfigDesc'), path: '/admin/permission-center', icon: Key },
    { label: t('auditLogsAction'), description: t('auditLogsActionDesc'), path: '/admin/audit-logs', icon: ScrollText },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-muted-foreground text-xs uppercase tracking-[0.18em]">{t('adminOverview')}</p>
          <h1 className="text-foreground mt-2 text-3xl font-semibold tracking-tight">
            {t('greetingWithName', { greeting, name: displayName })}
          </h1>
        </div>
        <div className="text-muted-foreground text-sm lg:text-right">
          <div>{now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</div>
          <div className="mt-1">{now.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</div>
        </div>
      </header>

      <Section title={t('keyMetrics')} icon={Layers}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {stats.map(({ label, value, icon: Icon }) => (
            <div key={label} className="border-border rounded-lg border p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground text-sm">{label}</span>
                <Icon className="text-muted-foreground h-4 w-4" />
              </div>
              <div className="text-foreground mt-4 text-3xl font-semibold">
                {statsQuery.isLoading || value === undefined
                  ? '—'
                  : new Intl.NumberFormat(locale).format(value)}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title={t('quickActions')} icon={ShieldPlus}>
          <div className="divide-border divide-y">
            {actions.map(({ label, description, path, icon: Icon }) => (
              <button key={path} type="button" onClick={() => onNavigate(path)} className="hover:bg-accent/40 group flex w-full items-center gap-4 rounded-md px-2 py-4 text-left transition-colors">
                <Icon className="text-muted-foreground h-4 w-4" />
                <div className="min-w-0 flex-1">
                  <div className="text-foreground font-medium">{label}</div>
                  <div className="text-muted-foreground mt-1 text-sm">{description}</div>
                </div>
                <ArrowRight className="text-muted-foreground h-4 w-4" />
              </button>
            ))}
          </div>
        </Section>
        <RecentUsers onNavigate={onNavigate} locale={locale} />
      </div>
    </div>
  );
}

function RecentUsers({ onNavigate, locale }: { onNavigate: (path: string) => void; locale: string }) {
  const t = useTranslations('dashboard');
  const query = useAdminRecentUsersQuery();
  return (
    <Section
      title={t('recentActivity')}
      icon={Clock3}
      action={<Button variant="ghost" size="sm" onClick={() => onNavigate('/admin/users')}>{t('viewAll')}<ArrowRight className="ml-1 h-4 w-4" /></Button>}
    >
      {query.isLoading ? (
        <div className="text-muted-foreground py-10 text-center text-sm">{t('loading')}</div>
      ) : !query.data?.length ? (
        <div className="text-muted-foreground py-10 text-center text-sm">{t('noActivity')}</div>
      ) : (
        <div className="divide-border divide-y">
          {query.data.map((item) => (
            <div key={`${item.username}-${item.createdAt}`} className="flex items-center justify-between gap-4 py-4">
              <div>
                <div className="text-foreground text-sm font-medium">{item.realName || item.username}</div>
                <div className="text-muted-foreground mt-1 text-xs">{t('userCreated')}</div>
              </div>
              <time className="text-muted-foreground text-xs">{new Date(item.createdAt).toLocaleDateString(locale)}</time>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
