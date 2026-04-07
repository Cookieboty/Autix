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
import { cn } from '@/lib/utils';
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
    <aside
      className="w-[260px] flex flex-col flex-shrink-0 border-r"
      style={{ background: '#1a1a2e', borderColor: 'rgba(255,255,255,0.06)' }}
    >
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5 text-indigo-400" />
          <span className="font-semibold text-white text-sm">Autix AI</span>
        </div>
        <button
          onClick={handleNew}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium text-white cursor-pointer transition-colors"
          style={{ background: '#4338CA' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#4F46E5')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#4338CA')}
        >
          <Plus className="w-4 h-4" />
          新建对话
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-indigo-300/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索对话..."
            className="w-full pl-8 pr-3 py-2 rounded-lg text-xs text-indigo-100 placeholder:text-indigo-300/30 outline-none"
            style={{ background: 'rgba(30,27,75,0.6)', border: '1px solid rgba(99,102,241,0.2)' }}
          />
        </div>
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto px-2 space-y-4 py-2">
        {Object.entries(grouped).map(([group, items]) =>
          items.length > 0 ? (
            <div key={group}>
              <p className="px-2 py-1 text-xs font-medium" style={{ color: 'rgba(165,180,252,0.4)' }}>
                {group === 'Today' ? '今天' : group === 'Yesterday' ? '昨天' : '更早'}
              </p>
              {items.map((session) => (
                <div
                  key={session.id}
                  onClick={() => setActiveSession(session.id)}
                  onMouseEnter={() => setHovered(session.id)}
                  onMouseLeave={() => setHovered(null)}
                  className={cn(
                    'group relative flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors text-sm',
                    activeSessionId === session.id
                      ? 'text-white'
                      : 'text-indigo-200/60 hover:text-indigo-100'
                  )}
                  style={{
                    background: activeSessionId === session.id
                      ? 'rgba(67,56,202,0.3)'
                      : hovered === session.id
                      ? 'rgba(255,255,255,0.04)'
                      : 'transparent',
                  }}
                >
                  <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 text-indigo-400/60" />
                  <span className="flex-1 truncate text-xs">{session.title}</span>
                  {hovered === session.id && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                      className="flex-shrink-0 cursor-pointer text-red-400/60 hover:text-red-400"
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
          <p className="text-center text-xs py-8" style={{ color: 'rgba(165,180,252,0.3)' }}>
            还没有对话，点击"新建对话"开始
          </p>
        )}
      </div>

      {/* User footer */}
      <div className="p-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(67,56,202,0.4)' }}>
              <User className="w-3.5 h-3.5 text-indigo-300" />
            </div>
            <span className="text-xs text-indigo-200/70 truncate">
              {(user as any)?.realName || (user as any)?.username || '用户'}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="cursor-pointer text-indigo-300/40 hover:text-red-400 transition-colors"
            title="退出登录"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
