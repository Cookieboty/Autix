'use client';

import { useState } from 'react';
import { Film, History, LayoutGrid, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuthStore, useUiStore, type DirectVideoGenerationDto } from '@autix/shared-store';
import { OfferStrip, StudioDensitySlider } from '../parts';
import { VideoHistoryPanel, type PendingVideoGenerationCard } from './VideoHistoryPanel';
import { VideoGalleryWall } from './VideoGalleryWall';
import type { TemplateDensity } from '../generator-studio-helpers';
import { useGalleryFeedController } from '@autix/shared-store';

// ---------------------------------------------------------------------------
// Preview Dialog
// ---------------------------------------------------------------------------

function VideoPreviewDialog({
  item,
  onClose,
}: {
  item: DirectVideoGenerationDto | null;
  onClose: () => void;
}) {
  const t = useTranslations('publicGrowth.generator.studio');

  if (!item) return null;

  const videoUrl = item.videoUrl;
  const poster =
    item.thumbnailUrl ?? item.lastFrameUrl ?? item.materials.find((material) => material.url)?.url ?? undefined;

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
          <h2 className="truncate text-sm font-semibold text-foreground">{item.prompt}</h2>
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
              aria-label={item.prompt}
            />
          ) : poster ? (
            <img
              src={poster}
              alt={item.prompt}
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
  activeTab,
  pendingGeneration,
  onTabChange,
  historyItems,
  historyLoading,
  onDeleteHistory,
}: {
  activeTab: 'history' | 'gallery';
  pendingGeneration?: PendingVideoGenerationCard | null;
  onTabChange: (tab: 'history' | 'gallery') => void;
  historyItems: DirectVideoGenerationDto[];
  historyLoading?: boolean;
  onDeleteHistory: (id: string) => Promise<void>;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const openAuthModal = useUiStore((s) => s.openAuthModal);

  const [previewItem, setPreviewItem] = useState<DirectVideoGenerationDto | null>(null);
  // 卡片密度只在会话内有效（与 image studio 一致，不做持久化）
  const [density, setDensity] = useState<TemplateDensity>('normal');
  // 视频广场直接复用站内公开 feed，传 'VIDEO' 分流
  const {
    items: galleryItems,
    loading: galleryLoading,
    loadingMore: galleryLoadingMore,
    hasMore: galleryHasMore,
    loadMore: galleryLoadMore,
  } = useGalleryFeedController('VIDEO');

  // 右栏不加上下内边距：与左侧 aside 一起贴容器的 py-3，保证两栏顶部对齐
  return (
    <main className="relative min-w-0 lg:h-full">
      {/* Tab Toggle。lg 起脱离文档流浮在滚动区之上，滚动时固定在顶部；
          容器本身 pointer-events-none，只让两个子块可点，避免挡住下方内容的滚轮与点击。 */}
      <div className="z-30 mb-2.5 flex flex-wrap items-center justify-between gap-2 lg:pointer-events-none lg:absolute lg:inset-x-0 lg:top-0 lg:mb-0">
        <div className="growth-panel pointer-events-auto inline-flex rounded-[11px] border p-1">
          {/* History tab — disabled when not authenticated */}
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => onTabChange('history')}
              className={`inline-flex min-h-8 items-center gap-1.5 rounded-[9px] px-3 text-xs font-bold transition ${activeTab === 'history'
                ? 'growth-panel-item text-foreground'
                : 'text-foreground/42 hover:text-foreground/76'
                }`}
            >
              <History className="size-3.5" />
              {t('history')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openAuthModal({ mode: 'entry', returnTo: '/ai/video' })}
              title={t('historyLoginRequired')}
              className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-[9px] px-3 text-xs font-bold text-foreground/42 transition hover:text-foreground/76"
            >
              <History className="size-3.5" />
              {t('history')}
            </button>
          )}

          {/* How it works tab */}
          <button
            type="button"
            onClick={() => onTabChange('gallery')}
            className={`inline-flex min-h-8 items-center gap-1.5 rounded-[9px] px-3 text-xs font-bold transition ${activeTab === 'gallery'
              ? 'growth-panel-item text-foreground'
              : 'text-foreground/42 hover:text-foreground/76'
              }`}
          >
            <LayoutGrid className="size-3.5" />
            {t('gallery')}
          </button>
        </div>
        {/* 两个 tab 都支持缩放：History 与 Gallery 同样按密度决定列数 */}
        <div className="pointer-events-auto">
          <StudioDensitySlider label={t('density')} value={density} onChange={setDensity} />
        </div>
      </div>

      {/* 滚动区：lg 起铺满右栏、自身滚动，顶部留出悬浮 tab 的高度。
          内层 min-h-full + 卡片 flex-1 —— 内容短时卡片撑到视口底部，内容长时随内容增高。 */}
      <div className="lg:absolute lg:inset-0 lg:overflow-y-auto lg:overscroll-contain">
        <div className="flex flex-col lg:min-h-full lg:pt-12">
          <OfferStrip label={t('videoOffer')} premium={t('premiumPlans')} />

          {/* 内容卡片只保留上圆角：下沿贴着视口底部，圆角会露出背景显得断开 */}
          {isAuthenticated && activeTab === 'history' ? (
            <div className="growth-panel mt-2.5 rounded-t-[18px] border border-b-0 p-4 shadow-xl md:p-4 lg:flex-1">
              <VideoHistoryPanel
                items={historyItems}
                loading={historyLoading}
                pending={pendingGeneration}
                density={density}
                onSelectItem={setPreviewItem}
                onDelete={onDeleteHistory}
              />
            </div>
          ) : (
            /* Gallery：视频广场 */
            <div className="growth-panel mt-2.5 rounded-t-[18px] border border-b-0 p-3 shadow-xl md:p-4 lg:flex-1">
              <VideoGalleryWall
                items={galleryItems}
                loading={galleryLoading}
                loadingMore={galleryLoadingMore}
                hasMore={galleryHasMore}
                density={density}
                onLoadMore={galleryLoadMore}
              />
            </div>
          )}
        </div>
      </div>

      {/* Preview dialog */}
      <VideoPreviewDialog
        item={previewItem}
        onClose={() => setPreviewItem(null)}
      />
    </main>
  );
}
