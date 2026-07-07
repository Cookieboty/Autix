'use client';

import { ArrowRight, Link as LinkIcon, Sparkles, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useUiStore } from '@autix/shared-store';
import { getFallbackCreator } from './fallback';
import { MagneticButton } from './GrowthInteractions';
import { PublicGrowthShell } from './PublicGrowthShell';
import type { PublicCreatorDetail } from './types';

export function CreatorProfileView({ detail }: { detail?: PublicCreatorDetail | null }) {
  const t = useTranslations('publicGrowth.profile');
  const tGrowth = useTranslations('publicGrowth');
  const openAuthModal = useUiStore((state) => state.openAuthModal);
  const data = detail ?? getFallbackCreator(tGrowth);

  return (
    <PublicGrowthShell promo={{ label: t('promo', { handle: data.profile.handle }), href: `/u/${data.profile.handle}` }}>
      <main>
        <section className="relative overflow-hidden border-b border-border bg-background">
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
                <div className="mt-6 grid max-w-md grid-cols-1 gap-3">
                  <div className="rounded-md border border-border bg-secondary p-3">
                    <div className="text-xs text-foreground/45">{t('followers')}</div>
                    <div className="mt-1 text-2xl font-semibold">{data.profile.followerCount}</div>
                  </div>
                </div>
                <div className="mt-5 inline-flex items-center gap-2 text-xs text-foreground/45">
                  <LinkIcon className="size-3.5" />
                  {t('publicHandle', { handle: data.profile.handle })}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </PublicGrowthShell>
  );
}
