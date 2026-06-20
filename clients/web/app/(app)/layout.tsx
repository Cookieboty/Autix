'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@autix/shared-store';
import { useChatStore } from '@autix/shared-store';
import { AppSidebar } from '@autix/shared-ui/chat';
import { SidebarInset, SidebarProvider } from '@autix/shared-ui/ui';
import { TaskSseProvider } from '@/components/providers/TaskSseProvider';
import { NotificationDrawer } from '@autix/shared-ui/notifications';
import { useSystemFeatureFlag } from '@autix/shared-ui/hooks';
import { useTranslations } from 'next-intl';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('layout');
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const fetchSessions = useChatStore((s) => s.fetchSessions);
  const { enabled: chatEnabled, loading: chatFeatureLoading } = useSystemFeatureFlag('chatEnabled', false);
  const isWorkbenchRoute =
    pathname === '/workbench/image' || pathname === '/workbench/video';
  const isChatFeatureRoute =
    pathname === '/chat' || pathname.startsWith('/c/') || pathname.startsWith('/arena');
  const [sidebarOpen, setSidebarOpen] = useState(() => !isWorkbenchRoute);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) { router.replace('/login'); return; }
    if ((user as { status?: string } | null)?.status === 'PENDING') { router.replace('/pending'); return; }
    if (chatFeatureLoading) return;
    if (!chatEnabled && isChatFeatureRoute) {
      router.replace('/marketplace');
      return;
    }
    if (chatEnabled) fetchSessions();
  }, [hydrated, isAuthenticated, user, router, fetchSessions, chatEnabled, chatFeatureLoading, isChatFeatureRoute]);

  useEffect(() => {
    setSidebarOpen(!isWorkbenchRoute);
  }, [isWorkbenchRoute, pathname]);

  if (!hydrated || chatFeatureLoading || (!chatEnabled && isChatFeatureRoute)) {
    return (
      <div className="flex h-svh items-center justify-center bg-background">
        <div className="text-muted-foreground">{t('loading')}</div>
      </div>
    );
  }

  if (!isAuthenticated || (user as { status?: string } | null)?.status === 'PENDING') {
    return (
      <div className="flex h-svh items-center justify-center bg-background">
        <div className="text-muted-foreground">{t('loading')}</div>
      </div>
    );
  }

  return (
    <TaskSseProvider>
      <SidebarProvider
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        className="h-svh w-svw overflow-hidden bg-[linear-gradient(180deg,#020202_0%,#070707_52%,#0d0d0d_100%)]"
        style={{ '--sidebar-width-icon': '2.75rem' } as React.CSSProperties}
      >
        <AppSidebar showRecentChats={chatEnabled} />
        <SidebarInset className="flex min-h-0 flex-col overflow-hidden bg-black/70">
          <div className="min-h-0 flex-1 overflow-y-auto bg-transparent">{children}</div>
        </SidebarInset>
      </SidebarProvider>
      <NotificationDrawer />
    </TaskSseProvider>
  );
}
