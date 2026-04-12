'use client';

import { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { NotificationBell } from '../notifications/NotificationBell';

export function ChatSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { sessions, activeSessionId, createSession, setActiveSession, deleteSession } = useChatStore();
  const { theme, setTheme } = useTheme();
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const isLibrary = pathname === '/library';

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

  return (
    <aside
      className="w-[220px] flex flex-col flex-shrink-0 h-full"
      style={{ backgroundColor: 'var(--background)', borderRight: '1px solid var(--border)' }}
    >
      {/* ── Brand / Logo ── */}
      <div className="px-4 pt-5 pb-4 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <Image
            src="/logo.png"
            alt="Autix AI"
            width={28}
            height={28}
            className="rounded-lg flex-shrink-0"
          />
          <span className="text-sm font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
            Autix AI
          </span>
        </div>
      </div>

      {/* ── Nav actions ── */}
      <div className="px-2 pb-1 flex-shrink-0 space-y-0.5">
        {/* New Chat */}
        <button
          onClick={handleNewChat}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer"
          style={{ color: 'var(--foreground)' }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface)')
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')
          }
        >
          <Plus className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--muted)' }} />
          <span>新建会话</span>
        </button>

        {/* Library */}
        <button
          onClick={() => router.push('/library')}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer"
          style={{
            backgroundColor: isLibrary ? 'var(--surface)' : 'transparent',
            color: isLibrary ? 'var(--foreground)' : 'var(--foreground)',
          }}
          onMouseEnter={(e) => {
            if (!isLibrary)
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface)';
          }}
          onMouseLeave={(e) => {
            if (!isLibrary)
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
          }}
        >
          <BookOpen
            className="w-4 h-4 flex-shrink-0"
            style={{ color: isLibrary ? 'var(--accent)' : 'var(--muted)' }}
          />
          <span>资料库</span>
        </button>
      </div>

      {/* ── Recents header + search ── */}
      <div className="px-3 pt-3 pb-1 flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
            Recents
          </span>
          <button
            onClick={() => setSearchOpen((v) => !v)}
            className="p-1 rounded-md transition-colors cursor-pointer"
            style={{ color: 'var(--muted)' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--foreground)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--muted)')}
            title="搜索对话"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Expandable search bar */}
        {searchOpen && (
          <div
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs mb-1"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--accent)' }}
          >
            <Search className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--muted)' }} />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索对话..."
              className="flex-1 bg-transparent outline-none text-xs min-w-0"
              style={{ color: 'var(--foreground)' }}
            />
            <button
              onClick={() => { setSearchOpen(false); setSearch(''); }}
              className="flex-shrink-0 cursor-pointer"
              style={{ color: 'var(--muted)' }}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* ── Sessions list ── */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        {filtered.length > 0 ? (
          filtered.map((session) => (
            <div
              key={session.id}
              onClick={async () => {
                await setActiveSession(session.id);
                router.push(`/c/${session.id}`);
              }}
              onMouseEnter={() => setHovered(session.id)}
              onMouseLeave={() => setHovered(null)}
              className="group relative flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors text-xs"
              style={{
                backgroundColor:
                  activeSessionId === session.id
                    ? 'var(--surface)'
                    : hovered === session.id
                    ? 'var(--surface)'
                    : 'transparent',
                color: activeSessionId === session.id ? 'var(--foreground)' : 'var(--muted)',
              }}
            >
              <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--muted)' }} />
              <span className="flex-1 truncate">{session.title}</span>
              {hovered === session.id && (
                <button
                  onClick={(e) => { e.stopPropagation(); void deleteSession(session.id); }}
                  className="flex-shrink-0 cursor-pointer"
                  style={{ color: 'var(--muted)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))
        ) : search ? (
          <p className="text-center text-xs py-6" style={{ color: 'var(--muted)' }}>
            无匹配对话
          </p>
        ) : (
          <p className="text-center text-xs py-6" style={{ color: 'var(--muted)' }}>
            暂无对话
          </p>
        )}
      </div>

      {/* ── User info + controls (bottom) ── */}
      <div
        className="flex-shrink-0 px-3 py-3"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          {/* Avatar */}
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
          >
            {avatarLetter}
          </div>

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

            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-1.5 rounded-md transition-colors cursor-pointer"
              style={{ color: 'var(--muted)' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--foreground)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--muted)')}
              title={theme === 'dark' ? '切换亮色' : '切换暗色'}
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={handleLogout}
              className="p-1.5 rounded-md transition-colors cursor-pointer"
              style={{ color: 'var(--muted)' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--danger)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--muted)')}
              title="退出登录"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
