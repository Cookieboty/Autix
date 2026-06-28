'use client';

import { useState } from 'react';
import { Box, Film, History, Upload, Video, WandSparkles, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuthStore, useVideoProjectStore, type VideoProject } from '@autix/shared-store';
import { SpotlightPanel } from '../../GrowthInteractions';
import { MediaThumb } from '../../MediaBlocks';
import type { PublicGrowthMediaItem } from '../../types';
import { OfferStrip } from '../parts';
import { VideoHistoryPanel } from './VideoHistoryPanel';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findPreviewVideoUrl(project: VideoProject): string | null {
  const generations = (project.clips ?? []).flatMap((clip) => clip.generations ?? []);
  const completed = generations
    .filter((g) => g.status === 'completed' && g.videoUrl)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return completed[0]?.videoUrl ?? null;
}

// ---------------------------------------------------------------------------
// Preview Dialog
// ---------------------------------------------------------------------------

function VideoPreviewDialog({
  project,
  onClose,
}: {
  project: VideoProject | null;
  onClose: () => void;
}) {
  const t = useTranslations('publicGrowth.generator.studio');

  if (!project) return null;

  const videoUrl = findPreviewVideoUrl(project);
  const poster = project.coverImage ?? undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10 sm:px-8"
      role="dialog"
      aria-modal="true"
      aria-label={t('historyPreviewTitle')}
    >
      {/* Backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="truncate text-sm font-semibold text-foreground">{project.title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="ml-2 grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Video / Poster */}
        <div className="relative aspect-video w-full bg-muted">
          {videoUrl ? (
            <video
              src={videoUrl}
              poster={poster}
              className="h-full w-full object-contain"
              controls
              autoPlay
              playsInline
              aria-label={project.title}
            />
          ) : poster ? (
            <img
              src={poster}
              alt={project.title}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Film className="size-12 text-muted-foreground" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function VideoHowItWorks({
  items,
  workbenchHref,
}: {
  items: PublicGrowthMediaItem[];
  workbenchHref: string;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [tab, setTab] = useState<'history' | 'howItWorks'>('howItWorks');
  const [previewProject, setPreviewProject] = useState<VideoProject | null>(null);

  const cards = [
    {
      title: t('addImage'),
      body: t('addImageBody'),
      item: items[0],
      label: t('uploadImage'),
      icon: Upload,
    },
    {
      title: t('choosePreset'),
      body: t('choosePresetBody'),
      item: items[1],
      label: t('choosePreset'),
      icon: WandSparkles,
    },
    {
      title: t('getVideo'),
      body: t('getVideoBody'),
      item: items[2],
      label: t('getVideo'),
      icon: Video,
    },
  ];

  return (
    <main className="min-w-0 flex-1 px-3 pb-2 pt-2 lg:order-1 lg:px-4">
      {/* Tab Toggle */}
      <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
        <div className="inline-flex rounded-[11px] border border-border bg-secondary p-1">
          {/* History tab — disabled when not authenticated */}
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => setTab('history')}
              className={`inline-flex min-h-8 items-center gap-1.5 rounded-[9px] px-3 text-xs font-bold transition ${
                tab === 'history'
                  ? 'bg-secondary text-foreground'
                  : 'text-foreground/42 hover:text-foreground/76'
              }`}
            >
              <History className="size-3.5" />
              {t('history')}
            </button>
          ) : (
            <button
              type="button"
              aria-disabled="true"
              title={t('historyLoginRequired')}
              className="inline-flex min-h-8 cursor-not-allowed items-center gap-1.5 rounded-[9px] px-3 text-xs font-bold text-foreground/42 opacity-50"
            >
              <History className="size-3.5" />
              {t('history')}
            </button>
          )}

          {/* How it works tab */}
          <button
            type="button"
            onClick={() => setTab('howItWorks')}
            className={`inline-flex min-h-8 items-center gap-1.5 rounded-[9px] px-3 text-xs font-bold transition ${
              tab === 'howItWorks'
                ? 'bg-secondary text-foreground'
                : 'text-foreground/42 hover:text-foreground/76'
            }`}
          >
            <Box className="size-3.5" />
            {t('howItWorks')}
          </button>
        </div>
      </div>

      <OfferStrip label={t('videoOffer')} premium={t('premiumPlans')} />

      {/* History panel */}
      {isAuthenticated && tab === 'history' ? (
        <div className="mt-2 rounded-[13px] border border-border bg-card p-4 shadow-xl md:p-4">
          <VideoHistoryPanel onSelectProject={setPreviewProject} />
        </div>
      ) : (
        /* How it works panel */
        <SpotlightPanel className="mt-2 rounded-[13px] border border-border bg-card p-4 shadow-xl md:p-4">
          <div className="growth-scan pointer-events-none absolute inset-x-0 top-0 h-20 opacity-14" />
          <div className="mb-3">
            <h1 className="text-3xl font-black uppercase leading-none md:text-[40px]">
              {t('videoHeroTitle')}
            </h1>
            <p className="mt-1.5 max-w-4xl text-xs font-semibold leading-5 text-foreground/42 md:text-sm">
              {t('videoHeroDescription')}
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            {cards.map((card, index) => {
              const Icon = card.icon;
              return (
                <a key={card.title} href={workbenchHref} className="group block">
                  <div className="growth-generator-video-card relative aspect-[16/10.4] overflow-hidden rounded-[12px] border border-border bg-background">
                    {card.item ? (
                      <MediaThumb item={card.item} eager={index === 0} autoPlay={index === 0} className="opacity-82 transition duration-700 group-hover:scale-[1.04]" />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-b from-background/10 to-background/60" />
                    <div className="absolute inset-7 rounded-[10px] border border-dashed border-border bg-background/12" />
                    <div className="absolute left-1/2 top-1/2 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[11px] border border-input bg-background/45 text-foreground backdrop-blur">
                      <Icon className="size-6" />
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <span className="inline-flex rounded-[8px] bg-growth-accent px-2 py-1 text-[10px] font-black uppercase text-background">
                        {card.label}
                      </span>
                    </div>
                  </div>
                  <h2 className="mt-2.5 text-lg font-black uppercase">{card.title}</h2>
                  <p className="mt-1 text-xs font-medium leading-5 text-foreground/45">{card.body}</p>
                </a>
              );
            })}
          </div>
        </SpotlightPanel>
      )}

      {/* Preview dialog */}
      <VideoPreviewDialog
        project={previewProject}
        onClose={() => setPreviewProject(null)}
      />
    </main>
  );
}
