'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
import {
  Plus,
  MessageSquare,
  Search,
  Trash2,
  LogOut,
  BookOpen,
  Sun,
  Moon,
  X,
  Settings,
} from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Button, Avatar } from '@heroui/react';
import { NotificationBell } from '../notifications/NotificationBell';

export function ChatSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { sessions, activeSessionId, createSession, setActiveSession, deleteSession } = useChatStore();
  const { theme, setTheme } = useTheme();
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const isLibrary = pathname === '/library';
  const isModels = pathname === '/models';

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const filtered = sessions.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleNewChat = async () => {
    const id = await createSession('新对话');
    setSearchOpen(false);
    setSearch('');
    router.push(`/c/${id}`);
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const displayName = (user as any)?.realName || (user as any)?.username || '用户';
  const displayEmail = (user as any)?.email || '';
  const avatarLetter = displayName.charAt(0).toUpperCase();

  const navItems = [
    { label: '新建会话', icon: Plus, href: '/c/new', active: false, action: handleNewChat },
    { label: '资料库', icon: BookOpen, href: '/library', active: isLibrary },
    { label: '模型配置', icon: Settings, href: '/models', active: isModels },
  ];

  return (
    <aside
      className="w-[220px] flex flex-col flex-shrink-0 h-full"
      style={{ backgroundColor: 'var(--background)', borderRight: '1px solid var(--border)' }}
    >
      {/* Brand / Logo */}
      <div className="px-4 pt-5 pb-4 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <Image
            src="/logo.png"
            alt="Autix AI"
            width={28}
            height={28}
            style={{ width: 28, height: 28 }}
            className="rounded-lg flex-shrink-0"
          />
          <span className="text-sm font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
            Autix AI
          </span>
        </div>
      </div>

      {/* Nav actions */}
      <div className="px-2 pb-1 flex-shrink-0 space-y-0.5">
        {navItems.map(({ label, icon: Icon, href, active, action }) => {
          if (action) {
            return (
              <Button
                key={label}
                variant="ghost"
                className={`w-full justify-start h-10 px-3 text-sm font-medium cursor-pointer ${
                  active
                    ? 'bg-[var(--surface)] text-[var(--foreground)]'
                    : 'text-[var(--foreground)]'
                }`}
                onPress={action}
              >
                <Icon className="w-4 h-4 mr-2" style={{ color: active ? 'var(--accent)' : 'var(--muted)' }} />
                {label}
              </Button>
            );
          }
          return (
            <Button
              key={label}
              variant="ghost"
              className={`w-full justify-start h-10 px-3 text-sm font-medium cursor-pointer ${
                active
                  ? 'bg-[var(--surface)] text-[var(--foreground)]'
                  : 'text-[var(--foreground)]'
              }`}
              onPress={() => router.push(href!)}
            >
              <Icon className="w-4 h-4 mr-2" style={{ color: active ? 'var(--accent)' : 'var(--muted)' }} />
              {label}
            </Button>
          );
        })}
      </div>

      {/* Recents header + search */}
      <div className="px-3 pt-3 pb-1 flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
            Recents
          </span>
          <Button
            isIconOnly
            variant="ghost"
            size="sm"
            className="cursor-pointer min-w-7 h-7"
            onPress={() => setSearchOpen((v) => !v)}
            aria-label="搜索对话"
          >
            <Search className="w-3.5 h-3.5" style={{ color: 'var(--muted)' }} />
          </Button>
        </div>

        {/* Expandable search bar */}
        {searchOpen && (
          <div className="relative mb-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" style={{ color: 'var(--muted)' }} />
            <input
              ref={searchRef as any}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索对话..."
              className="w-full h-9 pl-9 pr-8 text-sm rounded-lg border bg-background text-foreground placeholder:text-muted"
              style={{ borderColor: 'var(--border)' }}
              onKeyDown={(e) => e.key === 'Escape' && setSearchOpen(false)}
            />
            {search && (
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                className="absolute right-1 top-1/2 -translate-y-1/2 cursor-pointer min-w-6 h-6"
                onPress={() => { setSearch(''); setSearchOpen(false); }}
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        {filtered.length > 0 ? (
          filtered.map((session) => {
            const isActive = activeSessionId === session.id;
            return (
              <div key={session.id} className="flex items-center gap-1 group">
                <Button
                  variant="ghost"
                  className={`flex-1 justify-start h-auto min-h-10 px-2.5 py-2 text-xs cursor-pointer ${
                    isActive
                      ? 'bg-[var(--surface)] text-[var(--foreground)]'
                      : 'text-[var(--muted)]'
                  }`}
                  onPress={() => {
                    setActiveSession(session.id);
                    router.push(`/c/${session.id}`);
                  }}
                >
                  <MessageSquare
                    className="w-3.5 h-3.5 flex-shrink-0 mr-2"
                    style={{ color: 'var(--muted)' }}
                  />
                  <span className="flex-1 truncate text-left">{session.title}</span>
                </Button>
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  className="cursor-pointer opacity-0 group-hover:opacity-100 min-w-6 h-6 flex-shrink-0"
                  onPress={() => deleteSession(session.id)}
                  aria-label="删除对话"
                >
                  <Trash2 className="w-3 h-3" style={{ color: 'var(--danger)' }} />
                </Button>
              </div>
            );
          })
        ) : (
          <p className="text-center text-xs py-6" style={{ color: 'var(--muted)' }}>
            {search ? '无匹配对话' : '暂无对话'}
          </p>
        )}
      </div>

      {/* User info + controls (bottom) */}
      <div
        className="flex-shrink-0 px-3 py-3"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          {/* Avatar */}
          <Avatar
            size="sm"
            className="flex-shrink-0 cursor-pointer"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
          >
            {avatarLetter}
          </Avatar>

          {/* Name + email */}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium truncate" style={{ color: 'var(--foreground)' }}>
              {displayName}
            </p>
            {displayEmail && (
              <p className="text-[10px] truncate" style={{ color: 'var(--muted)' }}>
                {displayEmail}
              </p>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <NotificationBell />

            <Button
              isIconOnly
              variant="ghost"
              size="sm"
              className="cursor-pointer min-w-7 h-7"
              onPress={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={theme === 'dark' ? '切换亮色' : '切换暗色'}
            >
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5" style={{ color: 'var(--muted)' }} />
              ) : (
                <Moon className="w-3.5 h-3.5" style={{ color: 'var(--muted)' }} />
              )}
            </Button>

            <Button
              isIconOnly
              variant="ghost"
              size="sm"
              className="cursor-pointer min-w-7 h-7"
              onPress={handleLogout}
              aria-label="退出登录"
            >
              <LogOut className="w-3.5 h-3.5" style={{ color: 'var(--muted)' }} />
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
