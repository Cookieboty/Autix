'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';

const iconMap: Record<string, any> = {
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

export function Sidebar() {
  const pathname = usePathname();
  const { menus } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <aside className="fixed left-0 top-0 h-screen w-60 border-r bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="flex h-16 items-center border-b px-6">
          <Image src="/logo.png" alt="Autix" width={28} height={28} className="rounded-md" />
          <span className="ml-2.5 text-lg font-bold font-mono text-sidebar-primary">
            Autix
          </span>
        </div>
        <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
          <div className="text-muted-foreground text-sm text-center py-8">加载中...</div>
        </nav>
      </aside>
    );
  }

  const visibleMenus = menus.filter((menu) => menu.visible && !menu.parentId);

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 border-r bg-sidebar text-sidebar-foreground flex flex-col">
      <div className="flex h-16 items-center border-b px-6">
        <Image src="/logo.png" alt="Autix" width={28} height={28} className="rounded-md" />
        <span className="ml-2.5 text-lg font-bold font-mono text-sidebar-primary">
          Autix
        </span>
      </div>
      <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
        <Link
          href="/"
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer',
            pathname === '/'
              ? 'bg-sidebar-primary text-sidebar-primary-foreground'
              : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
          )}
        >
          <LayoutDashboard className="h-4 w-4 flex-shrink-0" />
          系统概览
        </Link>

        {visibleMenus.map((menu) => {
          const Icon = iconMap[menu.icon || 'Menu'] || Menu;
          const isActive =
            pathname === menu.path ||
            (menu.path !== '/' && pathname.startsWith(menu.path));
          return (
            <Link
              key={menu.id}
              href={menu.path}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {menu.name}
            </Link>
          );
        })}

        <Link
          href="/profile"
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer',
            pathname === '/profile'
              ? 'bg-sidebar-primary text-sidebar-primary-foreground'
              : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
          )}
        >
          <User className="h-4 w-4 flex-shrink-0" />
          个人信息
        </Link>
      </nav>
    </aside>
  );
}
