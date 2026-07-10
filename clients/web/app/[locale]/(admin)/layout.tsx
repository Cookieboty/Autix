'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { AdminSidebar } from '@autix/shared-ui/admin';
import { RouteLoader, SidebarInset, SidebarProvider } from '@autix/shared-ui/ui';
import { useAuthStore, useUiStore } from '@autix/shared-store';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, isAdmin, hydrated } = useAuthStore();
  const openAuthModal = useUiStore((s) => s.openAuthModal);
  const t = useTranslations('common');

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) { openAuthModal({ mode: 'login' }); return; }
    if (!isAdmin) { router.replace('/'); return; }
  }, [hydrated, isAuthenticated, isAdmin, router, openAuthModal]);

  if (!hydrated || !isAuthenticated || !isAdmin) {
    return <RouteLoader label={t('loading')} />;
  }

  return (
    <SidebarProvider
      className="h-svh w-svw overflow-hidden"
      style={{ '--sidebar-width-icon': '2.75rem' } as React.CSSProperties}
    >
      <AdminSidebar basePath="/admin" />
      <SidebarInset className="flex min-h-0 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
