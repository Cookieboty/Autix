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
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.72),#050505_62%,#050505_100%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-8 md:grid-cols-[minmax(0,1.2fr)_420px] md:px-6 md:py-12">
          <div className="grid gap-4">
            <section className="growth-tilt-card overflow-hidden rounded-md border border-white/12 bg-black shadow-[0_30px_110px_rgb(0_0_0/0.42)] transition duration-300">
              <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
                <span>{data.badge || data.mediaType}</span>
                <span>{data.modelUsed ?? 'Amux Studio'}</span>
              </div>
              <div className="relative aspect-video bg-black">
                <MediaThumb item={data} eager autoPlay className="object-contain" />
                <div className="growth-scan pointer-events-none absolute inset-x-0 top-0 h-24 opacity-30" />
              </div>
            </section>

            <SpotlightPanel className="grid gap-3 rounded-md border border-white/10 bg-white/[0.035] p-3 sm:grid-cols-3">
              {[
                [t('views'), data.viewCount ?? 0],
                [t('likes'), data.likeCount ?? 0],
                [t('shares'), data.shareCount ?? 0],
              ].map(([label, value]) => (
                <div key={label} className="relative overflow-hidden rounded-md border border-white/10 bg-black/36 p-4">
                  <div className="mb-4 h-px w-full bg-[linear-gradient(90deg,#c9ff82,transparent)]" />
                  <div className="text-xs text-white/45">{label}</div>
                  <div className="mt-1 text-2xl font-semibold">{value}</div>
                </div>
              ))}
            </SpotlightPanel>
          </div>

          <SpotlightPanel className="self-start rounded-md border border-white/10 bg-black/52 p-5 shadow-[0_24px_90px_rgb(0_0_0/0.34)] backdrop-blur-md">
          <div className="mb-4 inline-flex rounded-md bg-[#c9ff82] px-2 py-1 text-xs font-semibold text-black">
            {data.badge || data.mediaType}
          </div>
          <h1 className="text-4xl font-semibold leading-tight md:text-5xl">{data.title}</h1>
          <p className="mt-4 text-sm leading-6 text-white/62">{data.description || data.subtitle}</p>

          <a
            href={authorHref}
            className="mt-6 flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.04] p-3 hover:bg-white/[0.07]"
          >
            <div className="grid size-11 place-items-center overflow-hidden rounded-md bg-white/10">
              {data.author?.avatar ? (
                <img src={data.author.avatar} alt={data.author.displayName} className="h-full w-full object-cover" />
              ) : (
                <UserRound className="size-5 text-white/60" />
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">
                {data.author?.displayName ?? t('fallbackCreatorName')}
              </div>
              <div className="truncate text-xs text-white/50">
                {data.author ? `@${data.author.handle}` : t('fallbackCreatorSubtitle')}
              </div>
            </div>
          </a>

          <div className="mt-5 flex flex-wrap gap-2">
            {data.tags.map((tag) => (
              <span key={tag} className="rounded-md bg-white/10 px-2 py-1 text-xs text-white/72">
                {tag}
              </span>
            ))}
          </div>

          <section className="mt-5 overflow-hidden rounded-md border border-white/10 bg-white/[0.04]">
            <div className="grid grid-cols-2 border-b border-white/10 p-1">
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
                      ? 'bg-white text-black'
                      : 'text-white/58 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="relative min-h-36 p-4">
              <div className="absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,transparent,#c9ff82,transparent)]" />
              {panelMode === 'prompt' ? (
                <p className="text-sm leading-6 text-white/72">{promptCopy}</p>
              ) : (
                <div>
                  <p className="text-sm leading-6 text-white/68">
                    {data.description || data.subtitle || promptCopy}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md bg-black/40 px-3 py-2 text-white/62">
                      {data.modelUsed ?? 'Amux Studio'}
                    </div>
                    <div className="rounded-md bg-black/40 px-3 py-2 text-white/62">
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
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/10 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? t('copied') : t('copyLink')}
            </MagneticButton>
            <MagneticLink
              href={data.mediaType === 'video' ? '/ai/video' : '/ai/image'}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-[#c9ff82]"
            >
              <Sparkles className="size-4" />
              {t('useThis')}
            </MagneticLink>
            <MagneticButton
              type="button"
              onClick={() => openAuthModal({ mode: 'entry' })}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/10 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white sm:col-span-2"
            >
              <Heart className="size-4" />
              {t('likeOrFollow')}
            </MagneticButton>
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs text-white/45">
            <Share2 className="size-3.5" />
            {t('publishedOnly')}
          </div>
          </SpotlightPanel>
        </div>
      </main>
    </PublicGrowthShell>
  );
}
