'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@heroui/react';
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

  const visibleMenus = menus.filter((menu) => menu.visible && !menu.parentId);

  const NavItem = ({
    href,
    icon: Icon,
    children,
    isActive,
  }: {
    href: string;
    icon: any;
    children: React.ReactNode;
    isActive: boolean;
  }) => (
    <Link href={href} className="block">
      <Button
        variant={isActive ? 'secondary' : 'ghost'}
        className={`w-full justify-start h-11 px-3 text-sm font-medium cursor-pointer transition-colors ${
          isActive
            ? 'text-[var(--accent)] bg-[var(--surface-secondary)]'
            : 'text-[var(--foreground)] hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]'
        }`}
      >
        <Icon className="h-4 w-4 flex-shrink-0 mr-2" style={{ color: isActive ? 'var(--accent)' : 'var(--muted)' }} />
        {children}
      </Button>
    </Link>
  );

  if (!mounted) {
    return (
      <aside
        className="fixed left-0 top-0 h-screen w-60 border-r flex flex-col"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex h-16 items-center border-b px-6" style={{ borderColor: 'var(--border)' }}>
          <Image src="/logo.png" alt="Autix" width={28} height={28} className="rounded-md" />
          <span className="ml-2.5 text-lg font-bold font-mono" style={{ color: 'var(--accent)' }}>
            Autix
          </span>
        </div>
        <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
          <div className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>加载中...</div>
        </nav>
      </aside>
    );
  }

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-60 border-r flex flex-col"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="flex h-16 items-center border-b px-6" style={{ borderColor: 'var(--border)' }}>
        <Image src="/logo.png" alt="Autix" width={28} height={28} className="rounded-md" />
        <span className="ml-2.5 text-lg font-bold font-mono" style={{ color: 'var(--accent)' }}>
          Autix
        </span>
      </div>
      <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
        <NavItem href="/" icon={LayoutDashboard} isActive={pathname === '/'}>
          系统概览
        </NavItem>

        {visibleMenus.map((menu) => {
          const Icon = iconMap[menu.icon || 'Menu'] || Menu;
          const isActive =
            pathname === menu.path ||
            (menu.path !== '/' && pathname.startsWith(menu.path));
          return (
            <NavItem key={menu.id} href={menu.path} icon={Icon} isActive={isActive}>
              {menu.name}
            </NavItem>
          );
        })}

        <NavItem href="/profile" icon={User} isActive={pathname === '/profile'}>
          个人信息
        </NavItem>
      </nav>
    </aside>
  );
}
