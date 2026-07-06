'use client';

import {
  Compass,
  Home,
  Image as ImageIcon,
  UserRound,
  Video,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuthStore, useUiStore } from '@autix/shared-store';
import { PublicGeneratorAppNav } from './PublicGeneratorAppNav';
import { PublicPromoBar } from './PublicPromoBar';

const FOOTER_HEADLINE = 'The all-in-one AI studio for image & video creators';

const FOOTER_GROUPS: Array<{ title: string; links: Array<[string, string]> }> = [
  {
    title: 'Amux Studio',
    links: [
      ['Explore', '/'],
      ['Pricing', '/pricing'],
      ['Community', '/community'],
      ['Canvas', '/draw'],
      ['Marketing Studio', '/marketing-studio'],
      ['Cinema Studio', '/original-series'],
      ['Originals', '/original-series'],
      ['Docs', '/docs'],
    ],
  },
  {
    title: 'Image',
    links: [
      ['AI Image', '/ai/image'],
      ['Templates', '/ai/image?mode=templates'],
      ['Edit Image', '/ai/image'],
      ['Image Upscale', '/ai/image'],
      ['Nano Banana Pro', '/ai/image?model=Nano%20Banana%20Pro'],
      ['Nano Banana 2', '/ai/image?model=Nano%20Banana%202'],
      ['GPT Image 2', '/ai/image?model=GPT%20Image%202'],
      ['Seedream 5 Lite', '/ai/image?model=Seedream%205%20Lite'],
    ],
  },
  {
    title: 'Video',
    links: [
      ['AI Video', '/ai/video'],
      ['Create Video', '/ai/video'],
      ['Seedance 2.0', '/ai/video?model=Seedance%202.0'],
      ['Gemini Omni Flash', '/ai/video?model=Gemini%20Omni%20Flash'],
    ],
  },
  {
    title: 'Discover',
    links: [
      ['Presets', '/presets'],
      ['Viral Presets', '/viral-presets'],
      ['Community', '/community'],
      ['Membership', '/membership'],
      ['Pricing', '/pricing'],
    ],
  },
];

const FOOTER_SOCIAL: Array<[string, string]> = [
  ['X / Twitter', '#'],
  ['Youtube', '#'],
  ['Instagram', '#'],
  ['LinkedIn', '#'],
  ['Tiktok', '#'],
];

const FOOTER_LEGAL: Array<[string, string]> = [
  ['Privacy', '#'],
  ['Terms', '#'],
  ['Cookie Notice', '#'],
];

export function PublicFooter() {
  return (
    <footer className="bg-growth-accent text-background">
      <div className="mx-auto max-w-[1920px] px-6 py-14 md:px-10 md:py-20">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:pr-8">
            <h2 className="max-w-md text-3xl font-black uppercase leading-[1.05] tracking-tight md:text-4xl">
              {FOOTER_HEADLINE}
            </h2>
          </div>
          {FOOTER_GROUPS.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h3 className="mb-4 text-sm font-semibold text-background/45">{group.title}</h3>
              <ul className="space-y-2.5">
                {group.links.map(([label, href]) => (
                  <li key={label}>
                    <a
                      href={href}
                      className="text-sm text-background/80 transition hover:text-background"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-16 flex flex-col gap-5 border-t border-background/15 pt-6 md:flex-row md:items-center md:justify-between">
          <span className="text-sm font-bold text-background/80">Amux Studio</span>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-background/80">
            {FOOTER_SOCIAL.map(([label, href]) => (
              <a key={label} href={href} className="transition hover:text-background">
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-background text-foreground/55">
        <div className="mx-auto flex max-w-[1920px] flex-col gap-3 px-6 pt-4 pb-24 text-xs md:flex-row md:items-center md:justify-between md:px-10 md:pb-4">
          <span>© 2026 Amux Studio. All rights reserved.</span>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {FOOTER_LEGAL.map(([label, href]) => (
              <a key={label} href={href} className="transition hover:text-foreground">
                {label}
              </a>
            ))}
          </div>
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
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur-xl md:hidden">
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
              className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium text-foreground/62 hover:bg-secondary hover:text-foreground"
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
    <div className="min-h-svh bg-background text-foreground">
      <PublicPromoBar label={promo?.label} href={promo?.href} />
      <PublicGeneratorAppNav kind={navKind} />
      {children}
      <PublicFooter />
      <MobilePublicTabs />
    </div>
  );
}
