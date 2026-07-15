'use client';

import type { ComponentType } from 'react';
import { Gift, LogOut, Ticket, TimerReset, UserRound, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@autix/shared-store';
import { Link, usePathname, useRouter } from '../../navigation';

/** 账户设置左侧导航项。href 为去掉 locale 前缀的应用内路径。 */
type SettingsNavItem = {
  key: 'profile' | 'gifts' | 'subscription' | 'usage' | 'promo';
  href: string;
  icon: ComponentType<{ className?: string }>;
};

const NAV_ITEMS: SettingsNavItem[] = [
  { key: 'profile', href: '/me/settings', icon: UserRound },
  { key: 'gifts', href: '/me/settings/gifts', icon: Gift },
  { key: 'subscription', href: '/me/settings/subscription', icon: Wallet },
  { key: 'usage', href: '/me/settings/usage', icon: TimerReset },
  { key: 'promo', href: '/me/settings/promo', icon: Ticket },
];

function workspaceOwner(user: ReturnType<typeof useAuthStore.getState>['user']) {
  return user?.username || user?.realName || user?.email?.split('@')[0] || 'My';
}

/**
 * 账户设置外壳：顶部导航由 (public) layout 持久提供，这里只渲染
 * 「左侧设置导航 + 右侧内容」两栏。各设置页作为独立路由塞进 children。
 */
export function AccountSettingsShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('publicGrowth.accountSettings');
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const isActive = (href: string) =>
    href === '/me/settings'
      ? pathname === '/me/settings'
      : pathname === href || pathname.startsWith(`${href}/`);

  const handleSignOut = async () => {
    await logout();
    router.replace('/');
  };

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[1920px] gap-6 px-3 py-6 md:gap-10 md:px-5 md:py-10">
      <aside className="hidden w-[232px] shrink-0 md:flex">
        <div className="flex w-full flex-col">
          <p className="px-3 pb-4 text-xs font-medium text-foreground/45">
            {t('workspace', { name: workspaceOwner(user) })}
          </p>

          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                    active
                      ? 'bg-secondary text-foreground'
                      : 'text-foreground/62 hover:bg-secondary/60 hover:text-foreground'
                  }`}
                >
                  <span
                    className={`grid size-6 shrink-0 place-items-center rounded-lg transition ${
                      active ? 'bg-growth-accent/18 text-growth-accent' : 'text-foreground/45 group-hover:text-foreground'
                    }`}
                  >
                    <Icon className="size-4" />
                  </span>
                  {t(`nav.${item.key}`)}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-4 pt-6">
            <div className="rounded-2xl bg-[rgb(24,25,28)] p-4">
              <p className="text-sm font-semibold text-foreground">{t('discord.title')}</p>
              <p className="mt-1 text-xs leading-5 text-foreground/55">{t('discord.body')}</p>
              <a
                href="https://discord.com"
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-secondary px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary/70"
              >
                {t('discord.cta')}
              </a>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-2 px-3 text-sm font-medium text-foreground/62 transition hover:text-foreground"
            >
              <LogOut className="size-4" />
              {t('signOut')}
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-3xl">{children}</div>
      </main>
    </div>
  );
}
