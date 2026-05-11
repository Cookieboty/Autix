'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
import { AppSidebar, SidebarInset, SidebarProvider } from '@autix/shared-ui';
import { TaskSseProvider } from '@/components/providers/TaskSseProvider';
import { NotificationDrawer } from '@/components/notifications/NotificationPanel';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const fetchSessions = useChatStore((s) => s.fetchSessions);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) { router.replace('/login'); return; }
    if ((user as { status?: string } | null)?.status === 'PENDING') { router.replace('/pending'); return; }
    fetchSessions();
  }, [hydrated, isAuthenticated, user, router, fetchSessions]);

  if (!hydrated) {
    return (
      <div className="flex h-svh items-center justify-center bg-background">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  if (!isAuthenticated || (user as { status?: string } | null)?.status === 'PENDING') {
    return (
      <div className="flex h-svh items-center justify-center bg-background">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <TaskSseProvider>
      <SidebarProvider
        className="h-svh w-svw overflow-hidden"
        style={{ '--sidebar-width-icon': '2.75rem' } as React.CSSProperties}
      >
        <AppSidebar />
        <SidebarInset className="flex min-h-0 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </SidebarInset>
      </SidebarProvider>
      <NotificationDrawer />
    </TaskSseProvider>
  );
}
