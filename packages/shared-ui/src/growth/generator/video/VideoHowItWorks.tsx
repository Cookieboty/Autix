'use client';

import { History, LayoutGrid } from 'lucide-react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuthStore, useUiStore, type DirectVideoGenerationDto } from '@autix/shared-store';
import { StudioDensitySlider } from '../parts';
import { VideoHistoryPanel, type PendingVideoGenerationCard } from './VideoHistoryPanel';
import { VideoGalleryWall } from './VideoGalleryWall';
import type { TemplateDensity } from '../generator-studio-helpers';
import { useGalleryFeedController } from '@autix/shared-store';

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function VideoHowItWorks({
  activeTab,
  pendingGeneration,
  onTabChange,
  historyItems,
  historyLoading,
  onRecreate,
  onSelectionActiveChange,
  onHistoryChanged,
}: {
  activeTab: 'history' | 'gallery';
  pendingGeneration?: PendingVideoGenerationCard | null;
  onTabChange: (tab: 'history' | 'gallery') => void;
  historyItems: DirectVideoGenerationDto[];
  historyLoading?: boolean;
  /** 点击 Recreate：把该次生成的 prompt 应用回输入框。 */
  onRecreate?: (item: DirectVideoGenerationDto) => void;
  /** 多选态：父级据此切换「输入框 ↔ 操作栏」，与 image studio 同一交互。 */
  onSelectionActiveChange?: (active: boolean) => void;
  /** 发布/删除后重拉 history —— 徽章状态来自服务端，不靠本地内存猜。 */
  onHistoryChanged?: () => void;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const openAuthModal = useUiStore((s) => s.openAuthModal);

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
          {/* 引导付费条幅（OfferStrip）暂时摘掉：它无条件渲染、不读会员状态，
              已付费用户也会被劝「Go Unlimited」；且折扣数字是前端常量
              （discount.ts 的 DISCOUNT_PERCENT），与后端实际扣费用的 discountFactor
              是两套独立的数，对不上就是标价与实收不符。
              补上会员门槛 + 折扣改走后端来源后再放回来。 */}

          {/* 内容卡片只保留上圆角：下沿贴着视口底部，圆角会露出背景显得断开 */}
          {isAuthenticated && activeTab === 'history' ? (
            <div className="growth-panel mt-2.5 rounded-t-[18px] border border-b-0 p-4 shadow-xl md:p-4 lg:flex-1">
              <VideoHistoryPanel
                items={historyItems}
                loading={historyLoading}
                pending={pendingGeneration}
                density={density}
                onRecreate={onRecreate}
                onSelectionActiveChange={onSelectionActiveChange}
                onHistoryChanged={onHistoryChanged}
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
    </main>
  );
}
