'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { BookOpen, ChevronDown, ChevronRight, ArrowLeft, Sun, Moon, Menu, X, Languages } from 'lucide-react';
import { useTheme } from 'next-themes';
import { DOC_LOCALES, type DocLocale, getDocsConfig } from '@/lib/docs';

interface NavItem {
  label: string;
  href?: string;
  children?: { label: string; href: string }[];
}

const LOCALE_LABELS: Record<DocLocale, string> = {
  'zh-CN': '简体中文',
  en: 'English',
};

function NavGroup({ item, pathname }: { item: NavItem; pathname: string }) {
  const hasChildren = !!item.children;
  const isActive = item.href === pathname;
  const isChildActive = item.children?.some((c) => c.href === pathname);
  const [open, setOpen] = useState<boolean>(true);

  if (!hasChildren) {
    return (
      <Link
        href={item.href!}
        className="block px-3 py-1.5 rounded-md text-sm transition-colors"
        style={{
          color: isActive ? 'var(--foreground)' : 'var(--muted)',
          backgroundColor: isActive ? 'var(--nav-item-active)' : 'transparent',
          fontWeight: isActive ? 600 : 400,
        }}
      >
        {item.label}
      </Link>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer transition-colors"
        style={{ color: isChildActive ? 'var(--foreground)' : 'var(--muted)' }}
      >
        {item.label}
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div className="ml-3 mt-0.5 space-y-0.5 pl-3" style={{ borderLeft: '1px solid var(--border)' }}>
          {item.children!.map((child) => {
            const active = child.href === pathname;
            return (
              <Link
                key={child.href}
                href={child.href}
                className="block px-2 py-1 rounded-md text-[13px] transition-colors"
                style={{
                  color: active ? 'var(--accent)' : 'var(--muted)',
                  backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
                }}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function DocsLocaleLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const locale = (params.locale as string) || 'zh-CN';
  const { theme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  const config = getDocsConfig(locale);

  const switchLocalePath = (target: string) => {
    return pathname.replace(`/${locale}/`, `/${target}/`);
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--background)' }}>
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg cursor-pointer"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X className="w-5 h-5" style={{ color: 'var(--foreground)' }} /> : <Menu className="w-5 h-5" style={{ color: 'var(--foreground)' }} />}
      </button>

      {sidebarOpen && <div className="lg:hidden fixed inset-0 z-30 bg-black/30" onClick={() => setSidebarOpen(false)} />}

      <aside
        className={`fixed lg:static z-40 top-0 left-0 h-full w-[260px] flex-shrink-0 flex flex-col transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ backgroundColor: 'var(--surface)', borderRight: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2.5 px-5 h-14 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <BookOpen className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{config.ui.siteTitle}</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {config.nav.map((item) => (
            <NavGroup key={item.label} item={item} pathname={pathname} />
          ))}
        </nav>

        <div className="flex-shrink-0 px-3 py-3 space-y-1" style={{ borderTop: '1px solid var(--border)' }}>
          {/* Language switcher */}
          <div className="relative">
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors cursor-pointer"
              style={{ color: 'var(--muted)' }}
            >
              <Languages className="w-3.5 h-3.5" />
              {LOCALE_LABELS[locale as DocLocale] || locale}
            </button>
            {langOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setLangOpen(false)} />
                <div
                  className="absolute bottom-full left-0 mb-1 py-1 rounded-lg z-20 min-w-[140px]"
                  style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-panel)' }}
                >
                  {DOC_LOCALES.map((l) => (
                    <Link
                      key={l}
                      href={switchLocalePath(l)}
                      onClick={() => setLangOpen(false)}
                      className="block px-3 py-1.5 text-xs transition-colors"
                      style={{
                        color: l === locale ? 'var(--accent)' : 'var(--foreground)',
                        backgroundColor: l === locale ? 'var(--accent-soft)' : 'transparent',
                      }}
                    >
                      {LOCALE_LABELS[l]}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>

          <Link href="/" className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors" style={{ color: 'var(--muted)' }}>
            <ArrowLeft className="w-3.5 h-3.5" /> {config.ui.backToHome}
          </Link>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors cursor-pointer"
            style={{ color: 'var(--muted)' }}
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            {theme === 'dark' ? config.ui.lightMode : config.ui.darkMode}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 lg:px-12 py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
