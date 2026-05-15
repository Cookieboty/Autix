'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AdminSidebar } from '@autix/shared-ui';
import { SidebarInset, SidebarProvider } from '@autix/shared-ui/ui';
import { useAuthStore } from '@/store/auth.store';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, hydrated } = useAuthStore();
  const t = useTranslations('common');

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.push('/login');
    }
  }, [hydrated, isAuthenticated, router]);

  if (!hydrated || !isAuthenticated) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="text-muted-foreground">{t('loading')}</div>
      </div>
    );
  }

  return (
    <SidebarProvider
      className="h-svh w-svw overflow-hidden"
      style={{ '--sidebar-width-icon': '2.75rem' } as React.CSSProperties}
    >
      <AdminSidebar />
      <SidebarInset className="flex min-h-0 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
