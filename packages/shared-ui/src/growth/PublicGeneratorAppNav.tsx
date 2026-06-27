import { Box, Command, Folder, Gem, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ThemeLogo } from '../brand';
import { buildGeneratorNavItems } from './generator-nav-items';

export type PublicGeneratorAppNavKind = 'home' | 'image' | 'video';

export function PublicGeneratorAppNav({ kind }: { kind: PublicGeneratorAppNavKind }) {
  const t = useTranslations('publicGrowth.generator.studio');
  const navItems = buildGeneratorNavItems(kind).map((item) => ({
    label: t(`nav.${item.key}`),
    href: item.href,
    active: item.active,
    badge: item.badge ? t('nav.new') : undefined,
  }));

  return (
    <header className="relative z-30 border-b border-white/7 bg-[#080a09]/96 px-3 shadow-[0_16px_60px_rgb(0_0_0/0.35)] backdrop-blur-xl md:px-5">
      <div className="flex min-h-16 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <a href="/" className="grid size-9 shrink-0 place-items-center rounded-md bg-white">
            <ThemeLogo alt="Amux Studio" size={28} variant="dark" />
          </a>
          <a href="/community" className="hidden text-sm font-semibold text-white/62 hover:text-white md:inline-flex">
            {t('nav.explore')}
          </a>
          <div className="hidden h-4 w-px bg-white/12 md:block" />
          <nav className="hide-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto">
            {navItems.map((item) => (
              <a
                key={`${item.href}-${item.label}`}
                href={item.href}
                className={`inline-flex min-h-9 shrink-0 items-center gap-1 rounded-md px-2.5 text-sm font-semibold transition ${
                  item.active
                    ? 'bg-white/10 text-white'
                    : item.label === t('nav.supercomputer')
                      ? 'text-[#c9ff00]'
                      : 'text-white/55 hover:bg-white/8 hover:text-white'
                }`}
              >
                {item.label === t('nav.supercomputer') ? <Box className="size-3.5" /> : null}
                {item.label}
                {item.badge ? (
                  <span className="rounded bg-[#c9ff00]/18 px-1.5 py-0.5 text-[10px] font-bold text-[#c9ff00]">
                    {item.badge}
                  </span>
                ) : null}
              </a>
            ))}
          </nav>
        </div>

        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <div className="flex h-10 items-center gap-2 rounded-md border border-white/8 bg-white/[0.06] px-3 text-sm text-white/42">
            <Search className="size-4" />
            <span className="w-24">{t('nav.search')}</span>
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] text-white/45">
              <Command className="inline size-3" /> K
            </span>
          </div>
          <a
            href="/pricing"
            className="relative inline-flex min-h-10 items-center gap-2 rounded-md border border-white/8 bg-white/[0.08] px-3 text-sm font-semibold text-white hover:bg-white/12"
          >
            <Gem className="size-4" />
            {t('nav.pricing')}
            <span className="absolute -bottom-4 left-3 rounded-md bg-[#ff1675] px-1.5 py-0.5 text-[10px] font-bold text-white">
              30% OFF
            </span>
          </a>
          <a
            href="/materials"
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/8 bg-white/[0.08] px-3 text-sm font-semibold text-white hover:bg-white/12"
          >
            <Folder className="size-4 fill-[#8ad97c] text-[#8ad97c]" />
            {t('nav.assets')}
          </a>
          <a
            href="/login"
            className="grid size-10 place-items-center rounded-full border-2 border-[#c9ff00] bg-white/10 shadow-[0_0_24px_rgb(201_255_0/0.45)]"
            aria-label={t('nav.profile')}
          >
            <span className="size-6 rounded-full bg-[#d6ff2b]" />
          </a>
        </div>
      </div>
    </header>
  );
}
