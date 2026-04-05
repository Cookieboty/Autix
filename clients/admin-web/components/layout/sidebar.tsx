'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, Shield, Key, User, LayoutDashboard } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';

const menuItems = [
  { href: '/dashboard', label: '概览', icon: LayoutDashboard, permission: null },
  { href: '/dashboard/users', label: '用户管理', icon: Users, permission: 'user:read' },
  { href: '/dashboard/roles', label: '角色管理', icon: Shield, permission: 'role:read' },
  { href: '/dashboard/permissions', label: '权限管理', icon: Key, permission: 'permission:read' },
  { href: '/dashboard/profile', label: '个人信息', icon: User, permission: null },
];

export function Sidebar() {
  const pathname = usePathname();
  const { hasPermission } = useAuthStore();

  const visibleItems = menuItems.filter(
    (item) => item.permission === null || hasPermission(item.permission)
  );

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 border-r bg-white flex flex-col">
      <div className="flex h-16 items-center border-b px-6">
        <span className="text-lg font-bold font-mono" style={{ color: '#7C3AED' }}>
          RBAC Admin
        </span>
      </div>
      <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer',
                isActive
                  ? 'text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
              style={isActive ? { backgroundColor: '#7C3AED' } : {}}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
