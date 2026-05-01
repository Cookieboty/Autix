'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
import { ChatSidebar } from '@/components/chat/sidebar';
import { TaskSseProvider } from '@/components/providers/TaskSseProvider';
import { NotificationDrawer } from '@/components/notifications/NotificationPanel';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, user, hydrated } = useAuthStore();
  const { fetchSessions } = useChatStore();

  // 鉴权 + 加载会话列表（必须等 hydrate 完成才判断，避免初始 null state 误跳转）
  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) { router.replace('/login'); return; }
    if ((user as { status?: string } | null)?.status === 'PENDING') { router.replace('/pending'); return; }
    fetchSessions();
  }, [hydrated, isAuthenticated, user, router, fetchSessions]);

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div style={{ color: 'var(--muted)' }}>加载中...</div>
      </div>
    );
  }

  if (!isAuthenticated || (user as { status?: string } | null)?.status === 'PENDING') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div style={{ color: 'var(--muted)' }}>加载中...</div>
      </div>
    );
  }

  return (
    <TaskSseProvider>
      <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--app-shell)' }}>
        <ChatSidebar />
        <main className="flex-1 flex flex-col overflow-hidden px-3 py-3">
          <div
            className="flex-1 overflow-hidden rounded-lg"
            style={{
              backgroundColor: 'var(--panel)',
              border: '1px solid var(--border)',
            }}
          >
            {children}
          </div>
        </main>
      </div>
      <NotificationDrawer />
    </TaskSseProvider>
  );
}
