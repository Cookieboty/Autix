'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useUiStore } from '@/store/ui.store';
import { ChatSidebar } from '@/components/chat/sidebar';
import { LibraryView } from '@/components/library/LibraryView';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const { currentView } = useUiStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (mounted && !isAuthenticated) router.push('/login');
    if (mounted && user?.status === 'PENDING') router.push('/pending');
  }, [mounted, isAuthenticated, user, router]);

  if (!mounted || !isAuthenticated || user?.status === 'PENDING') return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <ChatSidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {currentView === 'library' ? <LibraryView /> : children}
      </main>
    </div>
  );
}
