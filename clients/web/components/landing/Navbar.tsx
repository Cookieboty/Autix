'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { Menu, X, Sun, Moon, Languages, ChevronDown, ImageIcon, Video, ArrowRight } from 'lucide-react';
import { useTheme } from '@autix/shared-ui/theme';
import { useTranslations } from 'next-intl';
import { useLanguageStore } from '@autix/shared-store';
import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS, type SupportedLanguage } from '@autix/i18n';
import { useAuthStore, useMarketplaceHomeController, useUiStore } from '@autix/shared-store';
import { ThemeLogo } from '@autix/shared-ui/brand';
import { useChatEnabled } from '@autix/shared-ui/hooks';

const MEGA_CATEGORIES = [
  // 暂时移除 agents 模板市场入口，专注图片与视频模板
  // { slug: 'agents', titleKey: 'mktAgentsTitle', descKey: 'mktAgentsDesc', icon: Bot, color: '#0ea5e9' },
  { slug: 'image-templates', titleKey: 'mktImageTitle', descKey: 'mktImageDesc', icon: ImageIcon, color: '#22c55e' },
  { slug: 'video-templates', titleKey: 'mktVideoTitle', descKey: 'mktVideoDesc', icon: Video, color: '#f59e0b' },
] as const;

export function Navbar() {
  const t = useTranslations('landing');
  const { scrollY } = useScroll();
  const bgOpacity = useTransform(scrollY, [0, 60], [0, 1]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { theme, setTheme } = useTheme();
  const { language, setLanguage } = useLanguageStore();
  const [langOpen, setLangOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const openAuthModal = useUiStore((s) => s.openAuthModal);
  const chatEnabled = useChatEnabled(false);
  const navTextColor = scrolled ? 'var(--foreground)' : '#fff';
  const navMutedColor = scrolled ? 'var(--muted)' : 'rgba(255,255,255,0.78)';
  const controlBorder = scrolled ? 'var(--border)' : 'rgba(255,255,255,0.24)';
  const controlSurface = scrolled ? 'transparent' : 'rgba(255,255,255,0.1)';

  const [megaOpen, setMegaOpen] = useState(false);
  const megaTimeout = useRef<ReturnType<typeof setTimeout>>(null);
  const { home, fetchHome } = useMarketplaceHomeController(false);

  const openMega = useCallback(() => {
    if (megaTimeout.current) clearTimeout(megaTimeout.current);
    setMegaOpen(true);
    if (!home) fetchHome();
  }, [home, fetchHome]);

  const closeMega = useCallback(() => {
    megaTimeout.current = setTimeout(() => setMegaOpen(false), 150);
  }, []);

  const cancelClose = useCallback(() => {
    if (megaTimeout.current) clearTimeout(megaTimeout.current);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const unsub = scrollY.on('change', (v) => setScrolled(v > 60));
    return unsub;
  }, [scrollY]);

  const docsLocale = language === 'zh-CN' || language === 'zh-TW' ? 'zh-CN' : 'en';
  const NAV_LINKS = [
    ...(chatEnabled ? [{ label: t('navProfessionalWorkbench'), href: '/workbench/image' }] : []),
    { label: t('navVideoCreation'), href: '/video' },
    ...(chatEnabled ? [{ label: t('navWorkspace'), href: '/chat' }] : []),
    { label: t('navPricing'), href: '#pricing' },
    { label: t('navDocs'), href: `/${docsLocale}/docs` },
    { label: t('navHelp'), href: '#faq' },
  ];

  const editorPicks =
    home?.editorPicks
      ?.filter((item) => (item as { resourceType?: string }).resourceType !== 'AGENT')
      .slice(0, 4) ?? [];

  return (
    <motion.header
      className="fixed top-0 left-0 right-0 z-50"
      style={{ backdropFilter: scrolled ? 'blur(12px)' : 'none' }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          backgroundColor: 'var(--surface)',
          opacity: bgOpacity,
          borderBottom: '1px solid var(--border)',
        }}
      />
      <div className="relative max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <ThemeLogo alt="Amux Studio" size={28} variant={scrolled ? 'auto' : 'dark'} />
          <span className="text-[15px] font-semibold tracking-tight" style={{ color: navTextColor }}>
            {t('brand')}
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {NAV_LINKS.slice(0, 2).map(({ label, href }) => (
            <Link key={label} href={href} className="text-sm transition-colors" style={{ color: navMutedColor }}>
              {label}
            </Link>
          ))}

          {/* Templates mega menu trigger */}
          <div
            className="relative"
            onMouseEnter={openMega}
            onMouseLeave={closeMega}
          >
            <button
              className="flex items-center gap-1 text-sm transition-colors cursor-pointer"
              style={{ color: navMutedColor }}
            >
              {t('navTemplates')}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${megaOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {NAV_LINKS.slice(2).map(({ label, href }) => (
            <Link key={label} href={href} className="text-sm transition-colors" style={{ color: navMutedColor }}>
              {label}
            </Link>
          ))}
        </nav>

        {/* Right controls */}
        <div className="hidden md:flex items-center gap-2">
          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={t('a11yToggleTheme')}
            className="p-2 rounded-md transition-colors cursor-pointer"
            style={{ color: navMutedColor }}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Language selector */}
          <div className="relative">
            <button
              onClick={() => setLangOpen(!langOpen)}
              aria-label={t('a11ySelectLanguage')}
              aria-haspopup="menu"
              aria-expanded={langOpen}
              className="p-2 rounded-md transition-colors cursor-pointer"
              style={{ color: navMutedColor }}
            >
              <Languages className="w-4 h-4" />
            </button>
            {langOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setLangOpen(false)} />
                <div
                  className="absolute right-0 top-full mt-1 py-1 rounded-lg z-20 min-w-[120px]"
                  style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-panel)' }}
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <button
                      key={lang}
                      onClick={() => { setLanguage(lang as SupportedLanguage); setLangOpen(false); }}
                      className="w-full text-left px-3 py-1.5 text-xs transition-colors cursor-pointer"
                      style={{
                        color: language === lang ? 'var(--brand)' : 'var(--foreground)',
                        backgroundColor: language === lang ? 'var(--brand-soft)' : 'transparent',
                      }}
                    >
                      {LANGUAGE_LABELS[lang as SupportedLanguage]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Auth buttons */}
          {mounted && isAuthenticated ? (
            <Link
              href={chatEnabled ? '/chat' : '/gallery'}
              className="text-sm px-4 py-1.5 rounded-md font-medium transition-colors ml-2"
              style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
            >
              {chatEnabled ? t('navWorkspace') : t('navTemplates')}
            </Link>
          ) : (
            <>
              <button
                type="button"
                onClick={() => openAuthModal({ mode: 'entry' })}
                className="text-sm px-4 py-1.5 rounded-md transition-colors ml-2"
                style={{ color: navTextColor, border: `1px solid ${controlBorder}`, backgroundColor: controlSurface }}
              >
                {t('login')}
              </button>
              <button
                type="button"
                onClick={() => openAuthModal({ mode: 'register' })}
                className="text-sm px-4 py-1.5 rounded-md font-medium transition-colors"
                style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
              >
                {t('register')}
              </button>
            </>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden p-2 cursor-pointer"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? t('a11yCloseMenu') : t('a11yOpenMenu')}
          aria-expanded={mobileOpen}
          style={{ color: navTextColor }}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Desktop mega menu panel */}
      <AnimatePresence>
        {megaOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="hidden md:block absolute left-0 right-0 top-full"
            onMouseEnter={cancelClose}
            onMouseLeave={closeMega}
          >
            <div
              className="mx-auto max-w-5xl rounded-xl p-6 mt-1"
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                boxShadow: '0 25px 60px -12px rgba(0,0,0,0.35)',
                backdropFilter: 'blur(20px)',
              }}
            >
              <div className="grid grid-cols-12 gap-6">
                {/* Left: categories */}
                <div className="col-span-5 space-y-2">
                  {MEGA_CATEGORIES.map((c) => {
                    const Icon = c.icon;
                    return (
                      <Link
                        key={c.slug}
                        href={`/marketplace/${c.slug}`}
                        className="group flex items-center gap-4 rounded-lg p-3 transition-colors"
                        style={{ backgroundColor: 'transparent' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--accent)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        onClick={() => setMegaOpen(false)}
                      >
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
                          style={{ backgroundColor: c.color }}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                            {t(c.titleKey)}
                          </span>
                          <span className="block text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                            {t(c.descKey)}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </div>

                {/* Right: featured picks */}
                <div className="col-span-7 border-l pl-6" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>
                    {t('megaMenuFeatured')}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {editorPicks.map((item) => (
                      <Link
                        key={item.id}
                        href={`/marketplace/${typeToSlug((item as { resourceType: string }).resourceType)}/${item.id}`}
                        className="group flex items-center gap-3 rounded-lg p-2 transition-colors"
                        style={{ backgroundColor: 'transparent' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--accent)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        onClick={() => setMegaOpen(false)}
                      >
                        {item.coverImage ? (
                          <Image
                            src={item.coverImage}
                            alt={item.title}
                            width={48}
                            height={48}
                            className="h-12 w-12 shrink-0 rounded-md object-cover"
                          />
                        ) : (
                          <span
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md text-xs"
                            style={{ backgroundColor: 'var(--accent)', color: 'var(--muted)' }}
                          >
                            N/A
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                            {item.title}
                          </span>
                          <span className="block truncate text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                            {item.description || item.category}
                          </span>
                        </span>
                      </Link>
                    ))}
                  </div>
                  <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                    <Link
                      href="/gallery"
                      className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80"
                      style={{ color: 'var(--brand)' }}
                      onClick={() => setMegaOpen(false)}
                    >
                      {t('megaMenuViewAll')} <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile menu */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden px-6 pb-4 space-y-2"
          style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
        >
          {NAV_LINKS.slice(0, 2).map(({ label, href }) => (
            <Link key={label} href={href} className="block py-2 text-sm" style={{ color: 'var(--foreground)' }} onClick={() => setMobileOpen(false)}>
              {label}
            </Link>
          ))}
          <p className="py-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
            {t('navTemplates')}
          </p>
          {MEGA_CATEGORIES.map((c) => {
            const Icon = c.icon;
            return (
              <Link
                key={c.slug}
                href={`/marketplace/${c.slug}`}
                className="flex items-center gap-3 py-1.5 pl-2 text-sm"
                style={{ color: 'var(--foreground)' }}
                onClick={() => setMobileOpen(false)}
              >
                <Icon className="h-4 w-4" style={{ color: c.color }} />
                {t(c.titleKey)}
              </Link>
            );
          })}
          {NAV_LINKS.slice(2).map(({ label, href }) => (
            <Link key={label} href={href} className="block py-2 text-sm" style={{ color: 'var(--foreground)' }} onClick={() => setMobileOpen(false)}>
              {label}
            </Link>
          ))}
          <div className="flex items-center gap-2 py-2">
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={t('a11yToggleTheme')} className="p-2 rounded-md cursor-pointer" style={{ color: 'var(--muted)' }}>
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex gap-2 pt-2">
            {mounted && isAuthenticated ? (
              <Link href={chatEnabled ? '/chat' : '/gallery'} className="flex-1 text-center text-sm py-2 rounded-md font-medium" style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}>{chatEnabled ? t('navWorkspace') : t('navTemplates')}</Link>
            ) : (
              <>
                <button type="button" onClick={() => { setMobileOpen(false); openAuthModal({ mode: 'entry' }); }} className="flex-1 text-center text-sm py-2 rounded-md" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}>{t('login')}</button>
                <button type="button" onClick={() => { setMobileOpen(false); openAuthModal({ mode: 'register' }); }} className="flex-1 text-center text-sm py-2 rounded-md font-medium" style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}>{t('register')}</button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </motion.header>
  );
}

const RESOURCE_TYPE_SLUG: Record<string, string> = {
  IMAGE_TEMPLATE: 'image-templates',
  VIDEO_TEMPLATE: 'video-templates',
  AGENT: 'agents',
  SKILL: 'skills',
  MCP: 'mcp',
};

function typeToSlug(resourceType: string): string {
  return RESOURCE_TYPE_SLUG[resourceType] ?? 'image-templates';
}
