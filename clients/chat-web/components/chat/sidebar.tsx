'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
import {
  Plus,
  MessageSquare,
  Search,
  Trash2,
  LogOut,
  BookOpen,
  Compass,
  Sun,
  Moon,
} from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { icon: Plus, label: 'New Chat', action: 'new' },
  { icon: Search, label: 'Search Chats', action: 'search' },
  { icon: BookOpen, label: 'Library', action: 'library' },
  { icon: Compass, label: 'Explore', action: 'explore' },
];

export function ChatSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { sessions, activeSessionId, createSession, setActiveSession, deleteSession } = useChatStore();
  const { theme, setTheme } = useTheme();
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  const filtered = sessions.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase())
  );

  const isLibrary = pathname === '/library';

  const handleNavAction = (action: string) => {
    if (action === 'new') {
      const id = createSession();
      setActiveSession(id);
      router.push('/');
    } else if (action === 'search') {
      setShowSearch((v) => !v);
    } else if (action === 'library') {
      router.push('/library');
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const displayName = (user as any)?.realName || (user as any)?.username || '用户';
  const displayEmail = (user as any)?.email || '';

  return (
    <aside
      className="w-[220px] flex flex-col flex-shrink-0 h-full"
      style={{ backgroundColor: 'var(--background)', borderRight: '1px solid var(--border)' }}
    >
      {/* User info at top */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
              {displayName}
            </p>
            {displayEmail && (
              <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>
                {displayEmail}
              </p>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-1 rounded-md transition-colors cursor-pointer"
              style={{ color: 'var(--muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--foreground)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
              title={theme === 'dark' ? '切换亮色模式' : '切换暗色模式'}
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={handleLogout}
              className="p-1 rounded-md transition-colors cursor-pointer"
              style={{ color: 'var(--muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
              title="退出登录"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation items */}
      <nav className="px-2 pb-2">
        {NAV_ITEMS.map(({ icon: Icon, label, action }) => (
          <button
            key={action}
            onClick={() => handleNavAction(action)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer text-left',
              action === 'new' && 'font-medium'
            )}
            style={{
              color: 'var(--foreground)',
              backgroundColor:
                action === 'library' && isLibrary
                  ? 'var(--surface)'
                  : 'transparent',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor =
                action === 'library' && isLibrary
                  ? 'var(--surface)'
                  : 'transparent';
            }}
          >
            <Icon className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--muted)' }} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* Search input (toggle) */}
      {showSearch && (
        <div className="px-3 pb-2">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
              style={{ color: 'var(--muted)' }}
            />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats..."
              className="w-full pl-8 pr-3 py-2 rounded-lg text-xs outline-none transition-colors"
              style={{
                backgroundColor: 'var(--surface)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </div>
        </div>
      )}

      {/* Separator + Recent label */}
      <div className="px-4 pt-1 pb-1">
        <p className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
          Recent
        </p>
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {filtered.map((session) => (
          <div
            key={session.id}
            onClick={() => {
              setActiveSession(session.id);
              router.push('/');
            }}
            onMouseEnter={() => setHovered(session.id)}
            onMouseLeave={() => setHovered(null)}
            className="relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm"
            style={{
              backgroundColor:
                activeSessionId === session.id
                  ? 'var(--surface)'
                  : hovered === session.id
                  ? 'var(--surface)'
                  : 'transparent',
              color:
                activeSessionId === session.id
                  ? 'var(--foreground)'
                  : 'var(--muted)',
            }}
          >
            <MessageSquare
              className="w-3.5 h-3.5 flex-shrink-0"
              style={{ color: 'var(--muted)' }}
            />
            <span className="flex-1 truncate text-xs">{session.title}</span>
            {hovered === session.id && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSession(session.id);
                }}
                className="flex-shrink-0 cursor-pointer transition-colors"
                style={{ color: 'var(--muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
        {sessions.length === 0 && (
          <p className="text-center text-xs py-8" style={{ color: 'var(--muted)' }}>
            No chats yet
          </p>
        )}
      </div>
    </aside>
  );
}
