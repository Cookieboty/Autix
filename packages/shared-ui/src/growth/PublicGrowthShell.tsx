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
import { Link, useRouter } from '../navigation';
import { PublicGeneratorAppNav } from './PublicGeneratorAppNav';
import { PublicPromoBar } from './PublicPromoBar';

const FOOTER_YEAR = '2026';

/**
 * `labelKey` resolves against `publicGrowth.footer.links`; a plain `label` is a
 * proper noun (model name) that stays untranslated in every locale.
 */
type FooterLink = { labelKey?: string; label?: string; href: string };

const FOOTER_GROUPS: Array<{ titleKey: string; links: FooterLink[] }> = [
  {
    titleKey: 'studio',
    links: [
      { labelKey: 'explore', href: '/' },
      { labelKey: 'pricing', href: '/pricing' },
      { labelKey: 'community', href: '/community' },
      { labelKey: 'canvas', href: '/draw' },
      { labelKey: 'marketingStudio', href: '/marketing-studio' },
      { labelKey: 'cinemaStudio', href: '/original-series' },
      { labelKey: 'originals', href: '/original-series' },
      { labelKey: 'docs', href: '/docs' },
    ],
  },
  {
    titleKey: 'image',
    links: [
      { labelKey: 'aiImage', href: '/ai/image' },
      { labelKey: 'templates', href: '/ai/image?mode=templates' },
      { labelKey: 'editImage', href: '/ai/image' },
      { labelKey: 'imageUpscale', href: '/ai/image' },
      { label: 'Nano Banana Pro', href: '/ai/image?model=Nano%20Banana%20Pro' },
      { label: 'Nano Banana 2', href: '/ai/image?model=Nano%20Banana%202' },
      { label: 'GPT Image 2', href: '/ai/image?model=GPT%20Image%202' },
      { label: 'Seedream 5 Lite', href: '/ai/image?model=Seedream%205%20Lite' },
    ],
  },
  {
    titleKey: 'video',
    links: [
      { labelKey: 'aiVideo', href: '/ai/video' },
      { labelKey: 'createVideo', href: '/ai/video' },
      { label: 'Seedance 2.0', href: '/ai/video?model=Seedance%202.0' },
      { label: 'Gemini Omni Flash', href: '/ai/video?model=Gemini%20Omni%20Flash' },
    ],
  },
  {
    titleKey: 'discover',
    links: [
      { labelKey: 'presets', href: '/presets' },
      { labelKey: 'viralPresets', href: '/viral-presets' },
      { labelKey: 'community', href: '/community' },
      { labelKey: 'membership', href: '/membership' },
      { labelKey: 'pricing', href: '/pricing' },
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
  ['privacy', '#'],
  ['terms', '#'],
  ['cookieNotice', '#'],
];

export function PublicFooter() {
  const t = useTranslations('publicGrowth.footer');

  return (
    <footer className="bg-growth-accent text-background">
      <div className="mx-auto max-w-[1920px] px-6 py-14 md:px-10 md:py-20">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:pr-8">
            <h2 className="max-w-md text-3xl font-black uppercase leading-[1.05] tracking-tight md:text-4xl">
              {t('headline')}
            </h2>
          </div>
          {FOOTER_GROUPS.map((group) => {
            const groupTitle = t(`groups.${group.titleKey}`);
            return (
              <nav key={group.titleKey} aria-label={groupTitle}>
                <h3 className="mb-4 text-sm font-semibold text-background/45">{groupTitle}</h3>
                <ul className="space-y-2.5">
                  {group.links.map((link) => {
                    const label = link.labelKey ? t(`links.${link.labelKey}`) : link.label!;
                    return (
                      <li key={`${link.labelKey ?? link.label}-${link.href}`}>
                        <Link
                          href={link.href}
                          className="text-sm text-background/80 transition hover:text-background"
                        >
                          {label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            );
          })}
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
          <span>{t('copyright', { year: FOOTER_YEAR })}</span>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {FOOTER_LEGAL.map(([labelKey, href]) => (
              <a key={labelKey} href={href} className="transition hover:text-foreground">
                {t(`legal.${labelKey}`)}
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
  const router = useRouter();
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
                router.push(item.href);
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
  showNav = true,
  showPromo = true,
}: {
  promo?: { label?: string; href?: string };
  children: React.ReactNode;
  navKind?: 'home' | 'image' | 'video' | 'community';
  /** false 时不渲染导航（由外层持久 (public) layout 提供），用于纳入持久导航的页面（首页/pricing） */
  showNav?: boolean;
  /** false 时不渲染顶部横幅（由外层持久 (public) layout 在导航上方提供） */
  showPromo?: boolean;
}) {
  return (
    <div className="min-h-svh bg-background text-foreground">
      {showPromo ? <PublicPromoBar label={promo?.label} href={promo?.href} /> : null}
      {showNav ? <PublicGeneratorAppNav kind={navKind} /> : null}
      {children}
      <PublicFooter />
      <MobilePublicTabs />
    </div>
  );
}
