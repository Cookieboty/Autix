'use client';

import { ArrowRight, ImageIcon, Video } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type {
  AnyResource,
  MarketplaceTypeSlug,
  PlatformStats as PlatformStatsData,
  ResourceType,
} from '@autix/shared-store';
import { EditorPicks } from './EditorPicks';
import { HotRankingList } from './HotRankingList';
import { MarketplaceChatDock } from './MarketplaceChatDock';
import { MarketplaceTopNav } from './MarketplaceTopNav';
import { PlatformStats } from './PlatformStats';
import { ResourceGrid } from './ResourceGrid';
import { MARKETPLACE_TYPES, TYPE_LABEL_KEY } from './resource-utils';

const CATEGORY_CARDS = [
  {
    slug: 'image-templates',
    titleKey: 'resourceType.imageTemplate',
    icon: ImageIcon,
    color: '#22c55e',
  },
  {
    slug: 'video-templates',
    titleKey: 'resourceType.videoTemplate',
    icon: Video,
    color: '#f59e0b',
  },
] satisfies {
  slug: string;
  titleKey: string;
  icon: LucideIcon;
  color: string;
}[];

function enabledPublicItems(items: AnyResource[]) {
  return items.filter(
    (item) => (item as { resourceType?: string }).resourceType !== 'AGENT',
  );
}

function dockResourceType(template: AnyResource | null): ResourceType {
  const resourceType = (template as { resourceType?: ResourceType } | null)
    ?.resourceType;
  return resourceType ?? 'IMAGE_TEMPLATE';
}

export function MarketplaceHomeView({
  loading,
  error,
  hotRecommendations,
  hotRanking,
  editorPicks,
  stats,
  chatEnabled,
  dockTemplate,
  onRetry,
  onSearch,
  onCategoryClick,
  onResourceClick,
  onUseTemplateInChat,
  onUseTemplateInWorkbench,
  onCloseChatDock,
}: {
  loading: boolean;
  error?: string | null;
  hotRecommendations: AnyResource[];
  hotRanking: AnyResource[];
  editorPicks: AnyResource[];
  stats: PlatformStatsData | null;
  chatEnabled: boolean;
  dockTemplate: AnyResource | null;
  onRetry: () => void;
  onSearch: (query: string) => void;
  onCategoryClick: (slug: string) => void;
  onResourceClick: (item: AnyResource) => void;
  onUseTemplateInChat?: (item: AnyResource) => void;
  onUseTemplateInWorkbench: (item: AnyResource) => void;
  onCloseChatDock: () => void;
}) {
  const t = useTranslations('marketplace');
  const visibleHotRanking = enabledPublicItems(hotRanking).slice(0, 5);
  const visibleEditorPicks = enabledPublicItems(editorPicks).slice(0, 4);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <MarketplaceTopNav currentSlug="" onSearch={onSearch} />
      <div className="flex-1 overflow-y-auto">
        {error && !loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-[linear-gradient(180deg,#020617_0%,#08111f_100%)] text-center">
            <p className="text-sm text-white/58">{error}</p>
            <button
              onClick={onRetry}
              className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-slate-950 transition-transform hover:scale-[1.03]"
            >
              {t('common.retry')}
            </button>
          </div>
        ) : (
          <div className="min-h-full bg-[linear-gradient(180deg,#020617_0%,#08111f_42%,var(--background)_100%)] px-4 py-5 text-white sm:px-6">
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12 space-y-7 lg:col-span-9">
                <section className="relative overflow-hidden rounded-lg border border-white/12 bg-white/[0.075] p-4 shadow-xl backdrop-blur-xl sm:p-5">
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        'linear-gradient(115deg, rgba(34,197,94,0.10) 0%, rgba(249,115,22,0.10) 100%)',
                    }}
                  />
                  <div className="absolute inset-x-0 top-0 h-px bg-white/20" />
                  <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                        {t('home.title')}
                      </h1>
                      <p className="mt-1 text-xs leading-5 text-white/58 sm:text-sm">
                        {t('home.subtitle')}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {CATEGORY_CARDS.map((category) => {
                        const CIcon = category.icon;
                        return (
                          <button
                            key={category.slug}
                            onClick={() => onCategoryClick(category.slug)}
                            className="group inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/8 px-4 py-2 text-xs font-medium text-white backdrop-blur-md transition-all hover:scale-[1.03] hover:border-white/24 hover:bg-white/14"
                          >
                            <span
                              className="flex h-6 w-6 items-center justify-center rounded-md text-white"
                              style={{ backgroundColor: category.color }}
                            >
                              <CIcon className="h-3.5 w-3.5" />
                            </span>
                            {t(category.titleKey)}
                            <ArrowRight className="h-3 w-3 opacity-50 transition-transform group-hover:translate-x-0.5" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </section>

                <section>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-white">
                      {t('home.hotMasonry')}
                    </h2>
                    <span className="text-xs text-white/46">
                      {t('home.imageVideo')}
                    </span>
                  </div>
                  <ResourceGrid
                    items={hotRecommendations}
                    onClickItem={onResourceClick}
                    onUseTemplateInChat={onUseTemplateInChat}
                    onUseTemplateInWorkbench={onUseTemplateInWorkbench}
                    columns={3}
                    layout="masonry"
                  />
                </section>
              </div>

              <aside className="col-span-12 lg:col-span-3 space-y-4">
                <HotRankingList items={visibleHotRanking} />
                <EditorPicks items={visibleEditorPicks} />
                <PlatformStats stats={stats} />
              </aside>
            </div>
          </div>
        )}
      </div>

      {chatEnabled && (
        <MarketplaceChatDock
          template={dockTemplate}
          resourceType={dockResourceType(dockTemplate)}
          onClose={onCloseChatDock}
        />
      )}
    </div>
  );
}

export function MarketplaceDesktopHomeView({
  hotRecommendations,
  hotRanking,
  editorPicks,
  stats,
  categoryTypes = MARKETPLACE_TYPES,
  onCategoryClick,
  onResourceClick,
}: {
  hotRecommendations: AnyResource[];
  hotRanking: AnyResource[];
  editorPicks: AnyResource[];
  stats: PlatformStatsData | null;
  categoryTypes?: MarketplaceTypeSlug[];
  onCategoryClick: (slug: MarketplaceTypeSlug) => void;
  onResourceClick: (item: AnyResource) => void;
}) {
  const t = useTranslations('marketplace');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <MarketplaceTopNav />
      <div className="flex-1 overflow-y-auto px-6 py-6 grid grid-cols-12 gap-6">
        <div className="col-span-9 space-y-6">
          <section
            className="p-6 rounded-lg"
            style={{
              background:
                'linear-gradient(135deg, var(--accent), var(--accent-secondary, #8b5cf6))',
              color: '#fff',
            }}
          >
            <h1 className="text-xl font-bold">{t('home.desktopTitle')}</h1>
            <p className="mt-1 text-sm opacity-90">
              {t('home.desktopSubtitle')}
            </p>
          </section>

          <div className="grid grid-cols-5 gap-3">
            {categoryTypes.map((type) => (
              <button
                key={type}
                onClick={() => onCategoryClick(type)}
                className="px-4 py-3 rounded-lg text-sm font-medium transition-colors hover:bg-[var(--panel-muted)]"
                style={{
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--panel)',
                  color: 'var(--foreground)',
                }}
              >
                {t(`resourceType.${TYPE_LABEL_KEY[type]}`)}
              </button>
            ))}
          </div>

          {hotRecommendations.length > 0 && (
            <section>
              <h2
                className="text-sm font-semibold mb-3"
                style={{ color: 'var(--foreground)' }}
              >
                {t('home.hotRecommendations')}
              </h2>
              <ResourceGrid
                items={hotRecommendations}
                columns={3}
                onClickItem={onResourceClick}
              />
            </section>
          )}
        </div>
        <aside className="col-span-3 space-y-4">
          <HotRankingList items={hotRanking} />
          <EditorPicks items={editorPicks} />
          {stats && <PlatformStats stats={stats} />}
        </aside>
      </div>
    </div>
  );
}
