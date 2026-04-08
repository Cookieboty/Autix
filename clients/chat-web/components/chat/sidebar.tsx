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
  User,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

function groupByDate(sessions: ReturnType<typeof useChatStore.getState>['sessions']) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups: Record<string, typeof sessions> = { Today: [], Yesterday: [], Earlier: [] };
  for (const s of sessions) {
    const d = new Date(s.updatedAt);
    d.setHours(0, 0, 0, 0);
    if (d >= today) groups['Today'].push(s);
    else if (d >= yesterday) groups['Yesterday'].push(s);
    else groups['Earlier'].push(s);
  }
  return groups;
}

export function ChatSidebar() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { sessions, activeSessionId, createSession, setActiveSession, deleteSession } = useChatStore();
  const [search, setSearch] = useState('');
  const [hovered, setHovered] = useState<string | null>(null);

  const filtered = sessions.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase())
  );
  const grouped = groupByDate(filtered);

  const handleNew = () => {
    const id = createSession();
    setActiveSession(id);
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <aside className="w-[260px] flex flex-col flex-shrink-0 border-r bg-background border-divider">
      {/* Header */}
      <div className="p-4 border-b border-divider">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5 text-primary" />
          <span className="font-semibold text-white text-sm">Autix AI</span>
        </div>
        <button
          onClick={handleNew}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium text-white cursor-pointer transition-all bg-primary hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          新建对话
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索对话..."
            className="w-full pl-8 pr-3 py-2 rounded-lg text-xs text-foreground placeholder:text-foreground/30 bg-secondary border border-border outline-none transition-colors focus:border-primary"
          />
        </div>
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto px-2 space-y-4 py-2">
        {Object.entries(grouped).map(([group, items]) =>
          items.length > 0 ? (
            <div key={group}>
              <p className="px-2 py-1 text-xs font-medium text-foreground/40">
                {group === 'Today' ? '今天' : group === 'Yesterday' ? '昨天' : '更早'}
              </p>
              {items.map((session) => (
                <div
                  key={session.id}
                  onClick={() => setActiveSession(session.id)}
                  onMouseEnter={() => setHovered(session.id)}
                  onMouseLeave={() => setHovered(null)}
                  className={`group relative flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors text-sm ${
                    activeSessionId === session.id
                      ? 'bg-primary/30 text-white'
                      : 'text-foreground/60 hover:bg-content2/50'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 text-foreground/40" />
                  <span className="flex-1 truncate text-xs">{session.title}</span>
                  {hovered === session.id && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                      className="flex-shrink-0 cursor-pointer text-danger hover:text-danger/70 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : null
        )}
        {sessions.length === 0 && (
          <p className="text-center text-xs py-8 text-foreground/30">
            还没有对话，点击"新建对话"开始
          </p>
        )}
      </div>

      {/* User footer */}
      <div className="p-3 border-t border-divider">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-primary/40">
              <User className="w-3.5 h-3.5 text-foreground/60" />
            </div>
            <span className="text-xs text-foreground/70 truncate">
              {(user as any)?.realName || (user as any)?.username || '用户'}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="cursor-pointer text-foreground/40 hover:text-danger transition-colors"
            title="退出登录"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
