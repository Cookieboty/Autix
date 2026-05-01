'use client';

import { useTranslations } from 'next-intl';
import { ThemeToggle } from './theme-toggle';
import { LanguageSelector } from '../../LanguageSelector';

export function Header() {
  const t = useTranslations('layout');

  return (
    <header
      className="fixed left-[272px] right-0 top-0 z-10 h-[88px] px-3 pt-3"
      style={{ backgroundColor: 'var(--app-shell)' }}
    >
      <div
        className="flex h-full items-center justify-between rounded-lg px-6"
        style={{
          backgroundColor: 'var(--admin-header-bg)',
          border: '1px solid var(--border)',
          backdropFilter: 'blur(18px)',
        }}
      >
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
            {t('adminWorkspace')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSelector />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
