'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Avatar, Button } from '@heroui/react';
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
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';

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
  return (
    <Link href={href} className="block">
      <Button
        variant="ghost"
        className="h-11 w-full cursor-pointer justify-start rounded-md px-3 text-sm font-medium transition-colors"
        style={{
          backgroundColor: isActive ? 'var(--nav-item-active)' : 'transparent',
          color: 'var(--foreground)',
        }}
      >
        <Icon
          className="mr-2.5 h-4 w-4 flex-shrink-0"
          style={{ color: isActive ? 'var(--foreground)' : 'var(--muted)' }}
        />
        {children}
      </Button>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { menus, user, logout } = useAuthStore();
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
          <nav className="flex-1 space-y-1.5 overflow-y-auto p-4">
            <div className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>加载中...</div>
          </nav>
        </div>
      </aside>
    );
  }

  const displayName = user?.realName || user?.username || '用户';
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
            系统概览
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
          <div className="rounded-md px-2.5 py-2" style={{ backgroundColor: 'var(--panel-muted)' }}>
            <div className="flex items-center gap-2.5">
              <Avatar
                size="sm"
                className="flex-shrink-0"
                style={{ backgroundColor: 'var(--surface-secondary)', color: 'var(--foreground)' }}
              >
                {initials}
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium" style={{ color: 'var(--foreground)' }}>
                  {displayName}
                </p>
                {displayEmail && (
                  <p className="mt-0.5 truncate text-[10px]" style={{ color: 'var(--muted)' }}>
                    {displayEmail}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1">
              <Button
                variant="ghost"
                className="h-9 flex-1 justify-start rounded-md px-3 text-sm"
                style={{ color: pathname === '/profile' ? 'var(--foreground)' : 'var(--muted)' }}
                onClick={() => router.push('/profile')}
              >
                <User className="mr-2 h-4 w-4" />
                个人信息
              </Button>
              <Button
                isIconOnly
                variant="ghost"
                className="h-9 min-w-9 rounded-md"
                style={{ color: 'var(--muted)' }}
                onClick={handleLogout}
                aria-label="退出登录"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
