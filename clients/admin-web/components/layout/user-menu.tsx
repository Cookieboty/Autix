'use client';

import { useSyncExternalStore } from 'react';
import { LogOut, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import {
  Dropdown,
  DropdownTrigger,
  DropdownPopover,
  DropdownMenu,
  DropdownItem,
  Separator,
} from '@heroui/react';
import { Avatar } from '@heroui/react';
import api from '@/lib/api';

const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function UserMenu() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const mounted = useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot);

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

  if (!mounted || !user) return null;

  const initials = (user.realName || user.username).charAt(0).toUpperCase();

  return (
    <Dropdown>
      <DropdownTrigger>
        <Avatar
          size="sm"
          className="cursor-pointer"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
        >
          {initials}
        </Avatar>
      </DropdownTrigger>
      <DropdownPopover className="w-56">
        <div className="flex flex-col space-y-1 px-3 py-2">
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            {user.realName || user.username}
          </p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>{user.email}</p>
        </div>
        <Separator />
        <DropdownMenu>
          <DropdownItem
            id="profile"
            onAction={() => router.push('/profile')}
            className="cursor-pointer"
          >
            <User className="h-4 w-4 inline mr-2" />
            个人信息
          </DropdownItem>
          <Separator />
          <DropdownItem
            id="logout"
            onAction={handleLogout}
            className="cursor-pointer text-danger"
          >
            <LogOut className="h-4 w-4 inline mr-2" />
            退出登录
          </DropdownItem>
        </DropdownMenu>
      </DropdownPopover>
    </Dropdown>
  );
}
