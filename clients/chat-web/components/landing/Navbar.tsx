'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Menu, X, Sun, Moon, Languages } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { useLanguageStore } from '@/store/language.store';
import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS, type SupportedLanguage } from '@autix/i18n';
import { useAuthStore } from '@autix/shared-store';

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

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const unsub = scrollY.on('change', (v) => setScrolled(v > 60));
    return unsub;
  }, [scrollY]);

  const docsLocale = language === 'zh-CN' || language === 'zh-TW' ? 'zh-CN' : 'en';
  const NAV_LINKS = [
    { label: t('navWorkspace'), href: '/chat' },
    { label: t('navPricing'), href: '#pricing' },
    { label: t('navDocs'), href: `/${docsLocale}/docs` },
    { label: t('navHelp'), href: '#faq' },
  ];

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
          <Image src="/logo.png" alt="Amux Studio" width={28} height={28} className="rounded-md" />
          <span className="text-[15px] font-semibold tracking-tight" style={{ color: 'var(--foreground)' }}>
            {t('brand')}
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map(({ label, href }) => (
            <Link key={label} href={href} className="text-sm transition-colors" style={{ color: 'var(--muted)' }}>
              {label}
            </Link>
          ))}
        </nav>

        {/* Right controls */}
        <div className="hidden md:flex items-center gap-2">
          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-md transition-colors cursor-pointer"
            style={{ color: 'var(--muted)' }}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Language selector */}
          <div className="relative">
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="p-2 rounded-md transition-colors cursor-pointer"
              style={{ color: 'var(--muted)' }}
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
              href="/chat"
              className="text-sm px-4 py-1.5 rounded-md font-medium transition-colors ml-2"
              style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
            >
              {t('navWorkspace')}
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm px-4 py-1.5 rounded-md transition-colors ml-2"
                style={{ color: 'var(--foreground)', border: '1px solid var(--border)' }}
              >
                {t('login')}
              </Link>
              <Link
                href="/register"
                className="text-sm px-4 py-1.5 rounded-md font-medium transition-colors"
                style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
              >
                {t('register')}
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden p-2 cursor-pointer"
          onClick={() => setMobileOpen(!mobileOpen)}
          style={{ color: 'var(--foreground)' }}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden px-6 pb-4 space-y-2"
          style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
        >
          {NAV_LINKS.map(({ label, href }) => (
            <Link key={label} href={href} className="block py-2 text-sm" style={{ color: 'var(--foreground)' }} onClick={() => setMobileOpen(false)}>
              {label}
            </Link>
          ))}
          <div className="flex items-center gap-2 py-2">
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2 rounded-md cursor-pointer" style={{ color: 'var(--muted)' }}>
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex gap-2 pt-2">
            {mounted && isAuthenticated ? (
              <Link href="/chat" className="flex-1 text-center text-sm py-2 rounded-md font-medium" style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}>{t('navWorkspace')}</Link>
            ) : (
              <>
                <Link href="/login" className="flex-1 text-center text-sm py-2 rounded-md" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}>{t('login')}</Link>
                <Link href="/register" className="flex-1 text-center text-sm py-2 rounded-md font-medium" style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}>{t('register')}</Link>
              </>
            )}
          </div>
        </motion.div>
      )}
    </motion.header>
  );
}
