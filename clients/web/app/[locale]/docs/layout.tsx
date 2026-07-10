'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname, getPathname } from '@/i18n/navigation';
import { BookOpen, ChevronDown, ChevronRight, ArrowLeft, Sun, Moon, Menu, X, Languages } from 'lucide-react';
import { useTheme } from '@autix/shared-ui/theme';
import { getDocsConfig } from '@/lib/docs';
import { getPolicy } from '@/lib/i18n/route-policy';

interface NavItem {
  label: string;
  href?: string;
  children?: { label: string; href: string }[];
}

const LOCALE_LABEL_KEYS: Record<string, string> = {
  'zh-CN': 'localeZhCN',
  en: 'localeEn',
};

function docLocales(): string[] {
  const policy = getPolicy('/docs');
  return policy.kind === 'partial' ? policy.locales : [];
}

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
                  color: active ? 'var(--brand)' : 'var(--muted)',
                  backgroundColor: active ? 'var(--brand-soft)' : 'transparent',
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
  const t = useTranslations('docsLayout');
  const pathname = usePathname(); // 已剥离 locale 前缀，与 lib/docs.ts 中的逻辑路径（base='/docs'）同域比较
  const locale = useLocale();
  const { theme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  const config = getDocsConfig(locale);
  const locales = docLocales();
  const getLocaleLabel = (value: string) => t(LOCALE_LABEL_KEYS[value] ?? 'localeEn');

  const switchLocalePath = (target: string) => getPathname({ href: pathname, locale: target });

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
          <BookOpen className="w-4 h-4" style={{ color: 'var(--brand)' }} />
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
              {locales.includes(locale) ? getLocaleLabel(locale) : locale}
            </button>
            {langOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setLangOpen(false)} />
                <div
                  className="absolute bottom-full left-0 mb-1 py-1 rounded-lg z-20 min-w-[140px]"
                  style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-panel)' }}
                >
                  {/* 纯 <a>，非 next-intl 的 <Link>：switchLocalePath() 已经是
                      getPathname() 算出的、带前缀的最终 URL，交给 <Link> 会再按
                      当前 locale 处理一遍造成双重前缀（如 /zh-CN/fr/docs）。 */}
                  {locales.map((l) => (
                    <a
                      key={l}
                      href={switchLocalePath(l)}
                      onClick={() => setLangOpen(false)}
                      className="block px-3 py-1.5 text-xs transition-colors"
                      style={{
                        color: l === locale ? 'var(--brand)' : 'var(--foreground)',
                        backgroundColor: l === locale ? 'var(--brand-soft)' : 'transparent',
                      }}
                    >
                      {getLocaleLabel(l)}
                    </a>
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
