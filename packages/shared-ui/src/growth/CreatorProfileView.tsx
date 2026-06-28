'use client';

import { useState } from 'react';
import { ArrowRight, Link as LinkIcon, Play, Sparkles, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useUiStore } from '@autix/shared-store';
import { getFallbackCreator } from './fallback';
import { MagneticButton, SpotlightPanel } from './GrowthInteractions';
import { MediaMasonryGrid, MediaRail, MediaThumb } from './MediaBlocks';
import { PublicGrowthShell } from './PublicGrowthShell';
import type { PublicGrowthMediaItem } from './types';
import type { PublicCreatorDetail } from './types';

function CreatorPortfolioStage({
  items,
  label,
}: {
  items: PublicGrowthMediaItem[];
  label: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = items[activeIndex] ?? items[0];
  const stageItems = items.slice(0, 6);
  if (!active) return null;

  return (
    <SpotlightPanel className="grid gap-3 rounded-md border border-border bg-background/44 p-3 growth-portfolio-shadow backdrop-blur md:grid-cols-[1fr_180px]">
      <a
        href={active.href}
        className="group relative min-h-[360px] overflow-hidden rounded-md border border-border bg-background md:min-h-[430px]"
      >
        <MediaThumb item={active} eager autoPlay className="transition duration-700 group-hover:scale-[1.04]" />
        <div className="absolute inset-0 growth-stage-card-overlay" />
        <div className="growth-scan pointer-events-none absolute inset-x-0 top-0 h-28 opacity-35" />
        <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-md bg-background/58 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/72 backdrop-blur">
          {active.mediaType === 'video' ? <Play className="size-3 fill-foreground" /> : <Sparkles className="size-3 text-growth-accent" />}
          {label}
        </div>
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h2 className="line-clamp-2 text-2xl font-semibold md:text-3xl">{active.title}</h2>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-foreground/62">
            {active.subtitle || active.description}
          </p>
        </div>
      </a>

      <div className="grid grid-cols-3 gap-2 md:grid-cols-1">
        {stageItems.map((item, index) => {
          const isActive = index === activeIndex;
          return (
            <button
              key={item.id}
              type="button"
              aria-label={item.title}
              onMouseEnter={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
              onClick={() => setActiveIndex(index)}
              className={`group relative min-h-24 overflow-hidden rounded-md border text-left transition duration-300 ${
                isActive
                  ? 'border-growth-accent/50 bg-secondary'
                  : 'border-border bg-secondary hover:border-border/24'
              }`}
            >
              <MediaThumb item={item} className="absolute inset-0 opacity-72 transition duration-500 group-hover:scale-[1.05]" />
              <div className="absolute inset-0 growth-card-bottom-overlay" />
              <div className="absolute inset-x-0 bottom-0 p-2">
                <div className="line-clamp-2 text-xs font-semibold text-foreground">{item.title}</div>
              </div>
            </button>
          );
        })}
      </div>
    </SpotlightPanel>
  );
}

export function CreatorProfileView({ detail }: { detail?: PublicCreatorDetail | null }) {
  const t = useTranslations('publicGrowth.profile');
  const tGrowth = useTranslations('publicGrowth');
  const openAuthModal = useUiStore((state) => state.openAuthModal);
  const data = detail ?? getFallbackCreator(tGrowth);
  const heroItem = data.creations[0] ?? null;

  return (
    <PublicGrowthShell promo={{ label: t('promo', { handle: data.profile.handle }), href: `/u/${data.profile.handle}` }}>
      <main>
        <section className="relative overflow-hidden border-b border-border bg-background">
          {heroItem ? (
            <div className="pointer-events-none absolute inset-0 opacity-28">
              <MediaThumb item={heroItem} eager className="h-full w-full scale-110 blur-2xl" />
            </div>
          ) : null}
          <div className="pointer-events-none absolute inset-0 growth-profile-hero-overlay" />
          <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-[320px_1fr] md:px-6 md:py-16">
            <div className="growth-tilt-card rounded-md border border-border bg-background/46 p-4 backdrop-blur-md transition duration-300">
              <div className="grid size-28 place-items-center overflow-hidden rounded-md bg-secondary">
                {data.profile.avatar ? (
                  <img src={data.profile.avatar} alt={data.profile.displayName} className="h-full w-full object-cover" />
                ) : (
                  <UserRound className="size-10 text-foreground/55" />
                )}
              </div>
              <div className="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground/45">
                <Sparkles className="size-3.5 text-growth-accent" />
                @{data.profile.handle}
              </div>
              <MagneticButton
                type="button"
                onClick={() => openAuthModal({ mode: 'entry' })}
                className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-growth-accent-hover"
              >
                {t('followCreator')}
                <ArrowRight className="size-4" />
              </MagneticButton>
            </div>
            <div className="grid gap-6">
              <div className="self-end">
                <h1 className="text-5xl font-semibold leading-[0.96] md:text-7xl">{data.profile.displayName}</h1>
                {data.profile.bio ? (
                  <p className="mt-5 max-w-2xl text-base leading-7 text-foreground/62 md:text-lg">{data.profile.bio}</p>
                ) : null}
                <div className="mt-6 grid max-w-md grid-cols-2 gap-3">
                  <div className="rounded-md border border-border bg-secondary p-3">
                    <div className="text-xs text-foreground/45">{t('followers')}</div>
                    <div className="mt-1 text-2xl font-semibold">{data.profile.followerCount}</div>
                  </div>
                  <div className="rounded-md border border-border bg-secondary p-3">
                    <div className="text-xs text-foreground/45">{t('published')}</div>
                    <div className="mt-1 text-2xl font-semibold">{data.creations.length}</div>
                  </div>
                </div>
                <div className="mt-5 inline-flex items-center gap-2 text-xs text-foreground/45">
                  <LinkIcon className="size-3.5" />
                  {t('publicHandle', { handle: data.profile.handle })}
                </div>
              </div>
              <CreatorPortfolioStage items={data.creations} label={t('worksEyebrow')} />
            </div>
          </div>
        </section>

        <MediaRail items={data.creations} label={t('worksEyebrow')} />

        <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
          <div className="mb-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-growth-accent">
              {t('worksEyebrow')}
            </div>
            <h2 className="text-3xl font-semibold md:text-4xl">{t('worksTitle')}</h2>
          </div>
          <MediaMasonryGrid items={data.creations} variant="rhythm" />
        </section>
      </main>
    </PublicGrowthShell>
  );
}
