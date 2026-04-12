'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
import { ChatSidebar } from '@/components/chat/sidebar';
import { TaskSseProvider } from '@/components/providers/TaskSseProvider';
import { NotificationDrawer } from '@/components/notifications/NotificationPanel';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const { fetchSessions } = useChatStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // 鉴权 + 加载会话列表
  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated) { router.replace('/login'); return; }
    if (user?.status === 'PENDING') { router.replace('/pending'); return; }
    // 已登录，加载会话列表
    fetchSessions();
  }, [mounted, isAuthenticated, user, router, fetchSessions]);

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div style={{ color: 'var(--muted)' }}>加载中...</div>
      </div>
    );
  }

  if (!isAuthenticated || user?.status === 'PENDING') return null;

  return (
    <TaskSseProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <ChatSidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          {children}
        </main>
      </div>
      <NotificationDrawer />
    </TaskSseProvider>
  );
}
