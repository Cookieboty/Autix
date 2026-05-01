'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Sidebar } from '@/components/layout/sidebar';
import { useAuthStore } from '@/store/auth.store';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, hydrated } = useAuthStore();
  const t = useTranslations('common');

  // hydrate 完成后才判断；在 render 中跳路由会触发 React 警告，所以放 useEffect
  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.push('/login');
    }
  }, [hydrated, isAuthenticated, router]);

  // 还没 hydrate 完，或者已确认未登录正在跳转 — 显示 loading
  if (!hydrated || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--app-shell)' }}>
      <Sidebar />
      <div className="pl-[272px]">
        <main className="px-3 py-3">
          <div
            className="min-h-[calc(100vh-24px)] rounded-lg p-8"
            style={{
              backgroundColor: 'var(--panel)',
              border: '1px solid var(--border)',
            }}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
