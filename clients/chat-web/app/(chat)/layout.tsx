'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { ChatSidebar } from '@/components/chat/sidebar';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (mounted && !isAuthenticated) router.push('/login');
    if (mounted && user?.status === 'PENDING') router.push('/pending');
  }, [mounted, isAuthenticated, user, router]);

  if (!mounted || !isAuthenticated || user?.status === 'PENDING') return null;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0F0F23' }}>
      <ChatSidebar />
      <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
    </div>
  );
}
