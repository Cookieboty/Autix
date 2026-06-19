'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@autix/shared-store';
import { useChatStore } from '@autix/shared-store';
import { AppSidebar } from '@autix/shared-ui/chat';
import { useSystemFeatureFlag } from '@autix/shared-ui/hooks';
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
  const { enabled: chatEnabled } = useSystemFeatureFlag('chatEnabled', false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated || !isAuthenticated || !chatEnabled) return;
    if ((user as { status?: string } | null)?.status === 'PENDING') return;
    fetchSessions();
  }, [hydrated, isAuthenticated, user, fetchSessions, chatEnabled]);

  return (
    <SidebarProvider
      className="h-svh w-svw overflow-hidden"
      style={{ '--sidebar-width-icon': '2.75rem' } as React.CSSProperties}
    >
      <AppSidebar showRecentChats={chatEnabled} />
      <SidebarInset className="flex min-h-0 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
