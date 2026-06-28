'use client';

import { useMemo, useState } from 'react';
import { Check, Copy, Heart, Share2, Sparkles, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useUiStore } from '@autix/shared-store';
import { getFallbackItems } from './fallback';
import { MagneticButton, MagneticLink, SpotlightPanel } from './GrowthInteractions';
import { MediaThumb } from './MediaBlocks';
import { PublicGrowthShell } from './PublicGrowthShell';
import type { PublicGrowthMediaItem } from './types';

export function PublicCreationDetailView({
  item,
}: {
  item?: PublicGrowthMediaItem | null;
}) {
  const t = useTranslations('publicGrowth.creation');
  const tGrowth = useTranslations('publicGrowth');
  const openAuthModal = useUiStore((state) => state.openAuthModal);
  const data = item ?? getFallbackItems(tGrowth)[0];
  const [copied, setCopied] = useState(false);
  const [panelMode, setPanelMode] = useState<'prompt' | 'remix'>('prompt');
  const authorHref = data.author ? `/u/${data.author.handle}` : '/community';
  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return data.href;
    return window.location.href;
  }, [data.href]);
  const promptCopy = data.prompt || t('promptHiddenDescription');

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <PublicGrowthShell promo={{ label: t('promo'), href: '/community' }}>
      <main className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-25">
          <MediaThumb item={data} eager className="h-full w-full scale-110 blur-2xl" />
        </div>
        <div className="pointer-events-none absolute inset-0 growth-hero-bg-fade-strong" />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-8 md:grid-cols-[minmax(0,1.2fr)_420px] md:px-6 md:py-12">
          <div className="grid gap-4">
            <section className="growth-tilt-card overflow-hidden rounded-md border border-border bg-background growth-deep-card-shadow transition duration-300">
              <div className="flex items-center justify-between border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/45">
                <span>{data.badge || data.mediaType}</span>
                <span>{data.modelUsed ?? 'Amux Studio'}</span>
              </div>
              <div className="relative aspect-video bg-background">
                <MediaThumb item={data} eager autoPlay className="object-contain" />
                <div className="growth-scan pointer-events-none absolute inset-x-0 top-0 h-24 opacity-30" />
              </div>
            </section>

            <SpotlightPanel className="grid gap-3 rounded-md border border-border bg-secondary p-3 sm:grid-cols-3">
              {[
                [t('views'), data.viewCount ?? 0],
                [t('likes'), data.likeCount ?? 0],
                [t('shares'), data.shareCount ?? 0],
              ].map(([label, value]) => (
                <div key={label} className="relative overflow-hidden rounded-md border border-border bg-background/36 p-4">
                  <div className="mb-4 h-px w-full growth-accent-line" />
                  <div className="text-xs text-foreground/45">{label}</div>
                  <div className="mt-1 text-2xl font-semibold">{value}</div>
                </div>
              ))}
            </SpotlightPanel>
          </div>

          <SpotlightPanel className="self-start rounded-md border border-border bg-background/52 p-5 growth-release-card-shadow backdrop-blur-md">
          <div className="mb-4 inline-flex rounded-md bg-growth-accent px-2 py-1 text-xs font-semibold text-background">
            {data.badge || data.mediaType}
          </div>
          <h1 className="text-4xl font-semibold leading-tight md:text-5xl">{data.title}</h1>
          <p className="mt-4 text-sm leading-6 text-foreground/62">{data.description || data.subtitle}</p>

          <a
            href={authorHref}
            className="mt-6 flex items-center gap-3 rounded-md border border-border bg-secondary p-3 hover:bg-secondary"
          >
            <div className="grid size-11 place-items-center overflow-hidden rounded-md bg-secondary">
              {data.author?.avatar ? (
                <img src={data.author.avatar} alt={data.author.displayName} className="h-full w-full object-cover" />
              ) : (
                <UserRound className="size-5 text-foreground/60" />
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">
                {data.author?.displayName ?? t('fallbackCreatorName')}
              </div>
              <div className="truncate text-xs text-foreground/50">
                {data.author ? `@${data.author.handle}` : t('fallbackCreatorSubtitle')}
              </div>
            </div>
          </a>

          <div className="mt-5 flex flex-wrap gap-2">
            {data.tags.map((tag) => (
              <span key={tag} className="rounded-md bg-secondary px-2 py-1 text-xs text-foreground/72">
                {tag}
              </span>
            ))}
          </div>

          <section className="mt-5 overflow-hidden rounded-md border border-border bg-secondary">
            <div className="grid grid-cols-2 border-b border-border p-1">
              {[
                ['prompt', data.prompt ? t('prompt') : t('promptHidden')],
                ['remix', t('useThis')],
              ].map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPanelMode(mode as 'prompt' | 'remix')}
                  className={`min-h-9 rounded-md px-3 text-sm font-semibold transition ${
                    panelMode === mode
                      ? 'bg-foreground text-background'
                      : 'text-foreground/58 hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="relative min-h-36 p-4">
              <div className="absolute inset-x-4 top-0 h-px growth-accent-line-centered" />
              {panelMode === 'prompt' ? (
                <p className="text-sm leading-6 text-foreground/72">{promptCopy}</p>
              ) : (
                <div>
                  <p className="text-sm leading-6 text-foreground/68">
                    {data.description || data.subtitle || promptCopy}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md bg-background/40 px-3 py-2 text-foreground/62">
                      {data.modelUsed ?? 'Amux Studio'}
                    </div>
                    <div className="rounded-md bg-background/40 px-3 py-2 text-foreground/62">
                      {data.mediaType}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <MagneticButton
              type="button"
              onClick={() => void copyLink()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground/80 hover:bg-secondary hover:text-foreground"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? t('copied') : t('copyLink')}
            </MagneticButton>
            <MagneticLink
              href={data.mediaType === 'video' ? '/ai/video' : '/ai/image'}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-growth-accent-hover"
            >
              <Sparkles className="size-4" />
              {t('useThis')}
            </MagneticLink>
            <MagneticButton
              type="button"
              onClick={() => openAuthModal({ mode: 'entry' })}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground/80 hover:bg-secondary hover:text-foreground sm:col-span-2"
            >
              <Heart className="size-4" />
              {t('likeOrFollow')}
            </MagneticButton>
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs text-foreground/45">
            <Share2 className="size-3.5" />
            {t('publishedOnly')}
          </div>
          </SpotlightPanel>
        </div>
      </main>
    </PublicGrowthShell>
  );
}
