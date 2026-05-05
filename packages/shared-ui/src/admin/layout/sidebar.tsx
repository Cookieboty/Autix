'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { Image } from '../../next-compat';
import { Link } from '../../navigation';
import { usePathname, useRouter } from '../../navigation';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { Avatar, AvatarFallback } from '../../ui/avatar';
import { Button } from '../../ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../../ui/dropdown-menu';
import {
  Users,
  Shield,
  Key,
  User,
  LayoutDashboard,
  Menu,
  Settings,
  FileText,
  Folder,
  Network,
  LogOut,
  Sun,
  Moon,
  Languages,
  MoreHorizontal,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuthStore } from '@autix/shared-store';
import { useLanguageStore } from '@autix/shared-store';
import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS, type SupportedLanguage } from '@autix/i18n';
import { userApi as api } from '@autix/shared-lib';

const emptySubscribe = () => () => { };
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

const iconMap: Record<string, LucideIcon> = {
  Users,
  Shield,
  Key,
  User,
  LayoutDashboard,
  Menu,
  Settings,
  FileText,
  Folder,
  Network,
};

function NavItem({
  href,
  icon: Icon,
  children,
  isActive,
}: {
  href: string;
  icon: LucideIcon;
  children: ReactNode;
  isActive: boolean;
}) {
  const label = typeof children === 'string' ? children : undefined;
  return (
    <Link href={href} className="block">
      <Button
        variant="ghost"
        className="w-full min-w-0 justify-start h-11 px-3.5 rounded-md text-sm font-medium cursor-pointer transition-colors"
        style={{
          backgroundColor: isActive ? 'var(--nav-item-active)' : 'var(--nav-item)',
          color: 'var(--foreground)',
        }}
      >
        <Icon
          className="w-4 h-4 mr-2.5 flex-shrink-0"
          style={{ color: isActive ? 'var(--foreground)' : 'var(--muted)' }}
        />
        <span className="min-w-0 flex-1 truncate text-left" title={label}>
          {children}
        </span>
      </Button>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { menus, user, logout } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage } = useLanguageStore();
  const t = useTranslations('layout');
  const mounted = useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot);

  const visibleMenus = menus.filter((menu) => menu.visible && !menu.parentId);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    } finally {
      logout();
      router.push('/login');
    }
  };

  if (!mounted) {
    return (
      <aside
        className="fixed left-0 top-0 h-screen w-[272px] p-3"
        style={{ backgroundColor: 'var(--app-shell)', borderRight: '1px solid var(--border)' }}
      >
        <div
          className="flex h-full flex-col overflow-hidden rounded-lg"
          style={{ backgroundColor: 'var(--admin-sidebar-bg)', border: '1px solid var(--border)' }}
        >
          <div className="flex h-[76px] items-center px-6" style={{ borderBottom: '1px solid var(--border)' }}>
            <Image src="/logo.png" alt="Amux Admin" width={30} height={30} className="rounded-md" />
            <div className="ml-3">
              <p className="text-[15px] font-semibold tracking-tight" style={{ color: 'var(--foreground)' }}>Amux Admin</p>
              <p className="mt-0.5 text-[11px]" style={{ color: 'var(--muted)' }}>Admin workspace</p>
            </div>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
            <div className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>{t('loading')}</div>
          </nav>
        </div>
      </aside>
    );
  }

  const displayName = user?.realName || user?.username || t('defaultUser');
  const displayEmail = user?.email || '';
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-[272px] p-3"
      style={{ backgroundColor: 'var(--app-shell)', borderRight: '1px solid var(--border)' }}
    >
      <div
        className="flex h-full flex-col overflow-hidden rounded-lg"
        style={{ backgroundColor: 'var(--admin-sidebar-bg)', border: '1px solid var(--border)' }}
      >
        <div className="flex h-[76px] items-center px-6" style={{ borderBottom: '1px solid var(--border)' }}>
          <Image src="/logo.png" alt="Amux Admin" width={30} height={30} className="rounded-md" />
          <div className="ml-3">
            <p className="text-[15px] font-semibold tracking-tight" style={{ color: 'var(--foreground)' }}>
              Amux Admin
            </p>
          </div>
        </div>
        <nav className="flex-1 space-y-1.5 overflow-y-auto p-4">
          <NavItem href="/" icon={LayoutDashboard} isActive={pathname === '/'}>
            {t('overview')}
          </NavItem>

          {visibleMenus.map((menu) => {
            const Icon = iconMap[menu.icon || 'Menu'] || Menu;
            const isActive = pathname === menu.path || (menu.path !== '/' && pathname.startsWith(menu.path));
            return (
              <NavItem key={menu.id} href={menu.path} icon={Icon} isActive={isActive}>
                {menu.name}
              </NavItem>
            );
          })}
        </nav>
        <div className="px-3 py-3" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="mb-2 px-1">
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-[var(--nav-item-hover)]"
                style={{ backgroundColor: 'transparent' }}
              >
                <Languages className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted)' }} />
                <span className="flex-1 text-xs" style={{ color: 'var(--foreground)' }}>
                  {LANGUAGE_LABELS[language]}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-[180px]">
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <DropdownMenuItem
                    key={lang}
                    onClick={() => setLanguage(lang)}
                  >
                    <div className="flex items-center gap-2">
                      {language === lang && <span className="text-xs text-primary">✓</span>}
                      <span className={language === lang ? 'font-medium' : ''}>{LANGUAGE_LABELS[lang]}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div
            className="flex items-center gap-1 rounded-md p-1"
            style={{ backgroundColor: 'var(--panel-muted)' }}
          >
            <button
              type="button"
              onClick={() => router.push('/profile')}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-[var(--nav-item-hover)]"
              aria-label={t('profile')}
            >
              <Avatar
                className="h-8 w-8 flex-shrink-0"
                style={{ backgroundColor: 'var(--surface-secondary)', color: 'var(--foreground)' }}
              >
                <AvatarFallback style={{ backgroundColor: 'var(--surface-secondary)', color: 'var(--foreground)' }}>
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-xs font-medium leading-[1.2]"
                  style={{ color: 'var(--foreground)' }}
                  title={displayName}
                >
                  {displayName}
                </p>
                {displayEmail && (
                  <p
                    className="mt-0.5 truncate text-[10px] leading-[1.2]"
                    style={{ color: 'var(--muted)' }}
                    title={displayEmail}
                  >
                    {displayEmail}
                  </p>
                )}
              </div>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-[var(--nav-item-hover)]"
                style={{ backgroundColor: 'transparent' }}
                aria-label={t('moreActions')}
              >
                <MoreHorizontal className="h-4 w-4" style={{ color: 'var(--muted)' }} />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="w-[220px]">
                <DropdownMenuItem
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                >
                  <div className="flex w-full items-center gap-2">
                    {theme === 'dark' ? (
                      <Sun className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted)' }} />
                    ) : (
                      <Moon className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted)' }} />
                    )}
                    <span className="flex-1 text-sm">
                      {theme === 'dark' ? t('switchLightMode') : t('switchDarkMode')}
                    </span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  <div
                    className="flex w-full items-center gap-2"
                    style={{ color: 'var(--danger, #ef4444)' }}
                  >
                    <LogOut className="h-4 w-4 flex-shrink-0" />
                    <span className="flex-1 text-sm">{t('logout')}</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </aside>
  );
}
