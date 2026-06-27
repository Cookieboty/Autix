'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@autix/shared-store';
import { useChatStore } from '@autix/shared-store';
import { useSystemFeatureFlag } from '@autix/shared-ui/hooks';

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
    <div className="h-svh w-svw overflow-hidden bg-black">{children}</div>
  );
}
