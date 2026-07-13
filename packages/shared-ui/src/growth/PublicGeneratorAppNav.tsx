'use client';

import { useEffect, useState } from 'react';
import { Folder, Gem, Search } from 'lucide-react';
import { useMessages, useTranslations } from 'next-intl';
import { BrandMark } from '../brand';
import { Link, usePathname } from '../navigation';
import { buildDiscountTranslationValues } from './discount';
import { buildGeneratorNavItems } from './generator-nav-items';
import { PublicAccountMenu } from './PublicAccountMenu';

export type PublicGeneratorAppNavKind = 'home' | 'image' | 'video' | 'community';

/** 由当前路由推导导航种类（持久单实例场景下不再靠 props 静态传入） */
function deriveNavKind(pathname: string): PublicGeneratorAppNavKind {
  if (pathname.startsWith('/ai/image')) return 'image';
  if (pathname.startsWith('/ai/video')) return 'video';
  return 'home';
}

const NAV_LABEL_FALLBACKS: Record<string, string> = {
  explore: 'Explore',
  image: 'Image',
  video: 'Video',
  community: 'Community',
  marketing: 'Marketing Studio',
  cinema: 'Cinema Studio',
  originals: 'Originals',
  canvas: 'Canvas',
  search: 'Search',
  pricing: 'Pricing',
  assets: 'Assets',
  profile: 'Profile',
  new: 'New',
  comingSoon: 'Coming soon',
  launchingSoon: 'Launching soon',
};

export function PublicGeneratorAppNav({
  kind: kindProp,
  variant: variantProp,
}: {
  /** 不传则由 pathname 推导（持久单实例用）；显式传用于非持久场景（如 shell 内的 community/presets） */
  kind?: PublicGeneratorAppNavKind;
  /** contained：定宽居中（首页/pricing）；fluid：全宽 + 始终收缩（功能页 image/video）。不传按 kind 推导 */
  variant?: 'contained' | 'fluid';
} = {}) {
  const pathname = usePathname();
  const kind = kindProp ?? deriveNavKind(pathname);
  const variant = variantProp ?? (kind === 'image' || kind === 'video' ? 'fluid' : 'contained');

  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // 功能页（fluid）以功能为主，导航始终保持收缩态；首页/pricing（contained）随滚动收缩
  const fluid = variant === 'fluid';
  const compact = fluid || scrolled;

  // 默认 52px / 收缩 36px；内部元素尺寸随之收缩
  const linkSize = compact ? 'min-h-6 px-2 text-[13px]' : 'min-h-8 px-2.5 text-sm';
  const pillSize = compact ? 'min-h-7 px-2.5 text-[13px]' : 'min-h-9 px-3 text-sm';

  const tCommon = useTranslations('publicGrowth.common');
  const messages = useMessages() as Record<string, unknown>;
  const navMessages =
    (((messages.publicGrowth as Record<string, unknown> | undefined)?.generator as Record<string, unknown> | undefined)
      ?.studio as Record<string, unknown> | undefined)?.nav as Record<string, unknown> | undefined;
  const navLabel = (key: string) => {
    if (typeof navMessages?.[key] === 'string') return navMessages[key] as string;
    return NAV_LABEL_FALLBACKS[key] ?? key;
  };
  const comingSoonLabel = typeof navMessages?.comingSoon === 'string'
    ? (navMessages.comingSoon as string)
    : NAV_LABEL_FALLBACKS.comingSoon;
  const navItems = buildGeneratorNavItems(kind).map((item) => {
    const badgeLabel =
      item.badge === 'soon'
        ? (typeof navMessages?.launchingSoon === 'string'
          ? (navMessages.launchingSoon as string)
          : NAV_LABEL_FALLBACKS.launchingSoon)
        : item.badge === 'new'
          ? (typeof navMessages?.new === 'string'
            ? (navMessages.new as string)
            : NAV_LABEL_FALLBACKS.new)
          : undefined;
    return {
      label: navLabel(item.key),
      href: item.href,
      active: item.active,
      badge: badgeLabel,
      badgeVariant: item.badge,
      disabled: item.disabled,
      separatorAfter: item.separatorAfter,
    };
  });

  return (
    <header
      // 功能页(fluid)透明，透出全屏固定主题背景以求统一；首页/pricing(contained) 用 bg-background
      className={`sticky top-0 z-30 transition-colors duration-300 ${fluid ? 'bg-transparent' : 'bg-background'}`}
    >
      <div className={`w-full px-3 transition-all duration-300 md:px-5 ${fluid ? 'max-w-none' : 'mx-auto max-w-[1920px]'}`}>
        <div
          className={`flex items-center justify-between gap-4 transition-all duration-300 ${compact ? 'h-9' : 'h-[52px]'
            }`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              aria-label="Amux Studio"
              className="grid shrink-0 place-items-center rounded-xl"
            >
              <BrandMark size={32} />
            </Link>
            <nav className="hide-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto">
              {navItems.map((item) => (
                <span key={`${item.href}-${item.label}`} className="contents">
                  {item.disabled ? (
                    <span
                      aria-disabled="true"
                      className={`group relative inline-flex shrink-0 cursor-not-allowed items-center gap-1 rounded-md font-semibold text-foreground/30 transition-all duration-300 ${linkSize}`}
                    >
                      {item.label}
                      {item.badge ? (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${item.badgeVariant === 'soon'
                            ? 'bg-growth-accent/18 text-growth-accent'
                            : 'bg-secondary text-foreground/40'
                            }`}
                        >
                          {item.badge}
                        </span>
                      ) : null}
                      <span
                        role="tooltip"
                        className="pointer-events-none absolute left-1/2 top-full z-40 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 text-[11px] font-semibold text-foreground/85 opacity-0 growth-tooltip-shadow transition group-hover:opacity-100 group-focus-within:opacity-100"
                      >
                        {item.badgeVariant === 'soon' ? item.badge : comingSoonLabel}
                      </span>
                    </span>
                  ) : (
                    <Link
                      href={item.href}
                      className={`inline-flex shrink-0 items-center gap-1 rounded-md font-semibold transition-all duration-300 ${linkSize} ${item.active
                        ? 'text-growth-accent'
                        : 'text-foreground/55 hover:bg-secondary hover:text-foreground'
                        }`}
                    >
                      {item.label}
                      {item.badge ? (
                        <span className="rounded bg-growth-accent/18 px-1.5 py-0.5 text-[10px] font-bold text-growth-accent">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  )}
                  {item.separatorAfter ? (
                    <span aria-hidden="true" className="mx-1 h-4 w-px shrink-0 bg-border" />
                  ) : null}
                </span>
              ))}
            </nav>
          </div>

          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            <button
              type="button"
              aria-label={navLabel('search')}
              className={`growth-nav-btn grid place-items-center text-foreground/60 transition-all duration-300 hover:text-foreground ${compact ? 'size-7' : 'size-9'
                }`}
            >
              <Search className="size-4" />
            </button>
            <Link
              href="/pricing"
              className={`growth-nav-btn relative inline-flex items-center gap-2 font-semibold text-foreground transition-all duration-300 ${pillSize}`}
            >
              <Gem className="size-4" />
              {navLabel('pricing')}
              <span
                className={`absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[60%] whitespace-nowrap rounded-md growth-nav-discount-badge font-bold text-foreground transition-all duration-300 ${compact ? 'px-1 py-0 text-[8px]' : 'px-1.5 py-0.5 text-[10px]'
                  }`}
              >
                {tCommon('discountBadge', buildDiscountTranslationValues())}
              </span>
            </Link>
            <Link
              href="/materials"
              className={`growth-nav-btn inline-flex items-center gap-2 font-semibold text-foreground transition-all duration-300 ${pillSize}`}
            >
              <Folder className="size-4 growth-assets-icon" />
              {navLabel('assets')}
            </Link>
            <PublicAccountMenu compact={compact} />
          </div>
        </div>
      </div>
    </header>
  );
}
