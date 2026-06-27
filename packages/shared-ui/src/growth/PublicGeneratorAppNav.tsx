import { Command, Folder, Gem, Search } from 'lucide-react';
import { useMessages } from 'next-intl';
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
    <header className="relative z-30 border-b border-white/7 bg-[#080a09]/96 px-3 shadow-[0_16px_60px_rgb(0_0_0/0.35)] backdrop-blur-xl md:px-5">
      <div className="flex min-h-16 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <a href="/" className="grid size-9 shrink-0 place-items-center rounded-md bg-white">
            <ThemeLogo alt="Amux Studio" size={28} variant="dark" />
          </a>
          <nav className="hide-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto">
            {navItems.map((item) => (
              <span key={`${item.href}-${item.label}`} className="contents">
                {item.disabled ? (
                  <span
                    aria-disabled="true"
                    className="group relative inline-flex min-h-9 shrink-0 cursor-not-allowed items-center gap-1 rounded-md px-2.5 text-sm font-semibold text-white/30"
                  >
                    {item.label}
                    {item.badge ? (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${item.badgeVariant === 'soon'
                            ? 'bg-[#c9ff00]/18 text-[#c9ff00]'
                            : 'bg-white/8 text-white/40'
                          }`}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute left-1/2 top-full z-40 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/12 bg-[#111] px-2 py-1 text-[11px] font-semibold text-white/85 opacity-0 shadow-[0_8px_24px_rgb(0_0_0/0.45)] transition group-hover:opacity-100 group-focus-within:opacity-100"
                    >
                      {item.badgeVariant === 'soon' ? item.badge : comingSoonLabel}
                    </span>
                  </span>
                ) : (
                  <a
                    href={item.href}
                    className={`inline-flex min-h-9 shrink-0 items-center gap-1 rounded-md px-2.5 text-sm font-semibold transition ${item.active
                      ? 'bg-white/10 text-white'
                      : 'text-white/55 hover:bg-white/8 hover:text-white'
                      }`}
                  >
                    {item.label}
                    {item.badge ? (
                      <span className="rounded bg-[#c9ff00]/18 px-1.5 py-0.5 text-[10px] font-bold text-[#c9ff00]">
                        {item.badge}
                      </span>
                    ) : null}
                  </a>
                )}
                {item.separatorAfter ? (
                  <span aria-hidden="true" className="mx-1 h-4 w-px shrink-0 bg-white/12" />
                ) : null}
              </span>
            ))}
          </nav>
        </div>

        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <div className="flex h-10 items-center gap-2 rounded-md border border-white/8 bg-white/[0.06] px-3 text-sm text-white/42">
            <Search className="size-4" />
            <span className="w-24">{navLabel('search')}</span>
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] text-white/45">
              <Command className="inline size-3" /> K
            </span>
          </div>
          <a
            href="/pricing"
            className="relative inline-flex min-h-10 items-center gap-2 rounded-md border border-white/8 bg-white/[0.08] px-3 text-sm font-semibold text-white hover:bg-white/12"
          >
            <Gem className="size-4" />
            {navLabel('pricing')}
            <span className="absolute -bottom-4 left-3 rounded-md bg-[#ff1675] px-1.5 py-0.5 text-[10px] font-bold text-white">
              30% OFF
            </span>
          </a>
          <a
            href="/materials"
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/8 bg-white/[0.08] px-3 text-sm font-semibold text-white hover:bg-white/12"
          >
            <Folder className="size-4 fill-[#8ad97c] text-[#8ad97c]" />
            {navLabel('assets')}
          </a>
          <PublicAccountMenu />
        </div>
      </div>
    </header>
  );
}
