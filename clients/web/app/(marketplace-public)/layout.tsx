'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
import { AppSidebar } from '@autix/shared-ui/chat';
import { SidebarInset, SidebarProvider } from '@autix/shared-ui/ui';

export default function MarketplacePublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hydrate = useAuthStore((s) => s.hydrate);
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const fetchSessions = useChatStore((s) => s.fetchSessions);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated || !isAuthenticated) return;
    if ((user as { status?: string } | null)?.status === 'PENDING') return;
    fetchSessions();
  }, [hydrated, isAuthenticated, user, fetchSessions]);

  return (
    <SidebarProvider
      className="h-svh w-svw overflow-hidden"
      style={{ '--sidebar-width-icon': '2.75rem' } as React.CSSProperties}
    >
      <AppSidebar />
      <SidebarInset className="flex min-h-0 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
