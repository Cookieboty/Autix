'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuthStore } from '@/store/auth.store';
import { ShieldCheck, ArrowLeft, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';

const NAV_ITEMS = [
  { label: '模板审核', icon: ShieldCheck, href: '/system/templates' },
];

export default function SystemLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isAdmin } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated) { router.replace('/login'); return; }
    if (!isAdmin) { router.replace('/chat'); return; }
  }, [mounted, isAuthenticated, isAdmin, router]);

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
        <div style={{ color: 'var(--muted)' }}>加载中...</div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) return null;

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--app-shell)' }}>
      {/* Sidebar */}
      <aside
        className="w-[220px] flex-shrink-0 flex flex-col h-full px-3 py-3"
        style={{ borderRight: '1px solid var(--border)' }}
      >
        <div
          className="flex h-full flex-col overflow-hidden rounded-lg"
          style={{ backgroundColor: 'var(--panel)', border: '1px solid var(--border)' }}
        >
          {/* Logo */}
          <div className="px-4 pt-5 pb-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-3">
              <Image src="/logo.png" alt="Amux Design" width={28} height={28} className="rounded-md flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[14px] font-semibold tracking-tight" style={{ color: 'var(--foreground)' }}>
                  系统管理
                </p>
                <p className="text-[11px]" style={{ color: 'var(--muted)' }}>Amux Design</p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
            {NAV_ITEMS.map(({ label, icon: Icon, href }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  style={{
                    color: active ? 'var(--foreground)' : 'var(--muted)',
                    backgroundColor: active ? 'var(--nav-item-active)' : 'transparent',
                  }}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Bottom actions */}
          <div className="flex-shrink-0 px-2 pb-3 space-y-0.5" style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
            <Link
              href="/chat"
              className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors"
              style={{ color: 'var(--muted)' }}
            >
              <ArrowLeft className="w-4 h-4 flex-shrink-0" />
              返回用户端
            </Link>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer"
              style={{ color: 'var(--muted)' }}
            >
              {theme === 'dark'
                ? <Sun className="w-4 h-4 flex-shrink-0" />
                : <Moon className="w-4 h-4 flex-shrink-0" />}
              {theme === 'dark' ? '浅色模式' : '深色模式'}
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden px-3 py-3">
        <div
          className="flex-1 overflow-hidden rounded-lg"
          style={{ backgroundColor: 'var(--panel)', border: '1px solid var(--border)' }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
