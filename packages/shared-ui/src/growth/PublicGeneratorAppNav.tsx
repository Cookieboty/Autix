import { Command, Folder, Gem, Search } from 'lucide-react';
import { useMessages, useTranslations } from 'next-intl';
import { ThemeLogo } from '../brand';
import { buildGeneratorNavItems } from './generator-nav-items';
import { PublicAccountMenu } from './PublicAccountMenu';

export type PublicGeneratorAppNavKind = 'home' | 'image' | 'video' | 'community';

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

export function PublicGeneratorAppNav({ kind }: { kind: PublicGeneratorAppNavKind }) {
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
    <header className="relative z-30 border-b border-border bg-card/96 px-3 growth-nav-shadow backdrop-blur-xl md:px-5">
      <div className="flex min-h-16 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <a href="/" className="grid size-9 shrink-0 place-items-center rounded-md bg-foreground">
            <ThemeLogo alt="Amux Studio" size={28} variant="dark" />
          </a>
          <nav className="hide-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto">
            {navItems.map((item) => (
              <span key={`${item.href}-${item.label}`} className="contents">
                {item.disabled ? (
                  <span
                    aria-disabled="true"
                    className="group relative inline-flex min-h-9 shrink-0 cursor-not-allowed items-center gap-1 rounded-md px-2.5 text-sm font-semibold text-foreground/30"
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
                  <a
                    href={item.href}
                    className={`inline-flex min-h-9 shrink-0 items-center gap-1 rounded-md px-2.5 text-sm font-semibold transition ${item.active
                      ? 'bg-secondary text-foreground'
                      : 'text-foreground/55 hover:bg-secondary hover:text-foreground'
                      }`}
                  >
                    {item.label}
                    {item.badge ? (
                      <span className="rounded bg-growth-accent/18 px-1.5 py-0.5 text-[10px] font-bold text-growth-accent">
                        {item.badge}
                      </span>
                    ) : null}
                  </a>
                )}
                {item.separatorAfter ? (
                  <span aria-hidden="true" className="mx-1 h-4 w-px shrink-0 bg-border" />
                ) : null}
              </span>
            ))}
          </nav>
        </div>

        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <div className="flex h-10 items-center gap-2 rounded-md border border-border bg-secondary px-3 text-sm text-foreground/42">
            <Search className="size-4" />
            <span className="w-24">{navLabel('search')}</span>
            <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] text-foreground/45">
              <Command className="inline size-3" /> K
            </span>
          </div>
          <a
            href="/pricing"
            className="relative inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-secondary px-3 text-sm font-semibold text-foreground hover:bg-accent"
          >
            <Gem className="size-4" />
            {navLabel('pricing')}
            <span className="absolute -bottom-4 left-3 rounded-md growth-nav-discount-badge px-1.5 py-0.5 text-[10px] font-bold text-foreground">
              {tCommon('discountBadge')}
            </span>
          </a>
          <a
            href="/materials"
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-secondary px-3 text-sm font-semibold text-foreground hover:bg-accent"
          >
            <Folder className="size-4 growth-assets-icon" />
            {navLabel('assets')}
          </a>
          <PublicAccountMenu />
        </div>
      </div>
    </header>
  );
}
