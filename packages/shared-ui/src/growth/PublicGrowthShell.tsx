'use client';

import {
  BadgeDollarSign,
  Compass,
  Home,
  Image as ImageIcon,
  UserRound,
  Video,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuthStore, useUiStore } from '@autix/shared-store';
import { ThemeLogo } from '../brand';
import { PublicGeneratorAppNav } from './PublicGeneratorAppNav';
import { PublicPromoBar } from './PublicPromoBar';

export function PublicFooter() {
  const t = useTranslations('publicGrowth.footer');
  const groups = [
    {
      title: t('groups.create'),
      links: [
        [t('links.aiImage'), '/ai/image'],
        [t('links.aiVideo'), '/ai/video'],
        [t('links.canvas'), '/canvas'],
        [t('links.marketingStudio'), '/marketing-studio'],
      ],
    },
    {
      title: t('groups.discover'),
      links: [
        [t('links.presets'), '/presets'],
        [t('links.viralPresets'), '/viral-presets'],
        [t('links.originalSeries'), '/original-series'],
      ],
    },
    {
      title: t('groups.platform'),
      links: [
        [t('links.pricing'), '/pricing'],
      ],
    },
  ];

  return (
    <footer className="border-t border-white/10 bg-[#050505] px-4 pb-24 pt-12 text-white md:pb-12">
      <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.2fr_2fr]">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <ThemeLogo alt="Amux Studio" size={32} variant="light" />
            Amux Studio
          </div>
          <p className="max-w-sm text-sm leading-6 text-white/55">
            {t('description')}
          </p>
          <a
            href="/pricing"
            className="mt-5 inline-flex items-center gap-2 rounded-md border border-white/14 px-3 py-2 text-sm text-white/72 hover:bg-white/8 hover:text-white"
          >
            <BadgeDollarSign className="size-4" />
            {t('plans')}
          </a>
        </div>
        <div className="grid gap-8 sm:grid-cols-3">
          {groups.map((group) => (
            <div key={group.title}>
              <h2 className="text-xs font-semibold uppercase text-white/45">{group.title}</h2>
              <div className="mt-3 grid gap-2">
                {group.links.map(([label, href]) => (
                  <a key={href} href={href} className="text-sm text-white/64 hover:text-white">
                    {label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}

export function MobilePublicTabs() {
  const t = useTranslations('publicGrowth.nav');
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const openAuthModal = useUiStore((state) => state.openAuthModal);
  const mobileTabs = [
    { label: t('home'), href: '/', icon: Home },
    { label: t('image'), href: '/ai/image', icon: ImageIcon },
    { label: t('video'), href: '/ai/video', icon: Video },
    { label: t('community'), href: '/community', icon: Compass },
    { label: t('me'), href: '/profile', icon: UserRound, auth: true },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/90 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur-xl md:hidden">
      <div className="grid grid-cols-5 gap-1">
        {mobileTabs.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.href}
              type="button"
              onClick={() => {
                if (item.auth && !isAuthenticated) {
                  openAuthModal({ mode: 'entry' });
                  return;
                }
                window.location.href = item.href;
              }}
              className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium text-white/62 hover:bg-white/8 hover:text-white"
              aria-label={item.label}
            >
              <Icon className="size-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function PublicGrowthShell({
  promo,
  children,
  navKind = 'home',
}: {
  promo?: { label?: string; href?: string };
  children: React.ReactNode;
  navKind?: 'home' | 'image' | 'video' | 'community';
}) {
  return (
    <div className="min-h-svh bg-black text-white">
      <PublicPromoBar label={promo?.label} href={promo?.href} />
      <PublicGeneratorAppNav kind={navKind} />
      {children}
      <PublicFooter />
      <MobilePublicTabs />
    </div>
  );
}
