'use client';

import { Bot, ImageIcon, Video } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type {
  AnyResource,
  MarketplaceTypeSlug,
  ResourceListSort,
} from '@autix/shared-store';
import { MarketplaceChatDock } from './MarketplaceChatDock';
import { MarketplaceTopNav } from './MarketplaceTopNav';
import { ResourceGrid } from './ResourceGrid';
import { SLUG_TO_RESOURCE_TYPE, TYPE_LABEL_KEY } from './resource-utils';

const SORT_TABS: { key: ResourceListSort; labelKey: string }[] = [
  { key: 'newest', labelKey: 'list.sortNewest' },
  { key: 'popular', labelKey: 'list.sortPopular' },
  { key: 'likes', labelKey: 'list.sortLikes' },
];

const TYPE_META: Record<
  MarketplaceTypeSlug,
  {
    eyebrowKey: string;
    descKey: string;
    icon: LucideIcon;
    accent: string;
    background: string;
  }
> = {
  agents: {
    eyebrowKey: 'list.agentEyebrow',
    descKey: 'list.agentDescription',
    icon: Bot,
    accent: '#0ea5e9',
    background:
      'linear-gradient(115deg, rgba(14,165,233,0.28), rgba(6,182,212,0.12) 52%, rgba(15,23,42,0.74))',
  },
  'image-templates': {
    eyebrowKey: 'list.imageEyebrow',
    descKey: 'list.imageDescription',
    icon: ImageIcon,
    accent: '#22c55e',
    background:
      'linear-gradient(115deg, rgba(34,197,94,0.26), rgba(20,184,166,0.12) 52%, rgba(15,23,42,0.74))',
  },
  'video-templates': {
    eyebrowKey: 'list.videoEyebrow',
    descKey: 'list.videoDescription',
    icon: Video,
    accent: '#f97316',
    background:
      'linear-gradient(115deg, rgba(249,115,22,0.28), rgba(245,158,11,0.12) 52%, rgba(15,23,42,0.74))',
  },
  skills: {
    eyebrowKey: 'list.skillsEyebrow',
    descKey: 'list.skillsDescription',
    icon: Bot,
    accent: '#8b5cf6',
    background:
      'linear-gradient(115deg, rgba(139,92,246,0.26), rgba(14,165,233,0.12) 52%, rgba(15,23,42,0.74))',
  },
  mcp: {
    eyebrowKey: 'list.mcpEyebrow',
    descKey: 'list.mcpDescription',
    icon: Bot,
    accent: '#06b6d4',
    background:
      'linear-gradient(115deg, rgba(6,182,212,0.26), rgba(14,165,233,0.12) 52%, rgba(15,23,42,0.74))',
  },
};

type MarketplaceListVariant = 'public' | 'desktop';

export function MarketplaceListView({
  slug,
  items,
  total,
  loading,
  error,
  sort,
  variant = 'public',
  emptyText,
  chatEnabled = false,
  dockTemplate = null,
  onSearch,
  onRetry,
  onSortChange,
  onClickItem,
  onUseTemplateInChat,
  onUseTemplateInWorkbench,
  onCloseChatDock,
}: {
  slug: MarketplaceTypeSlug;
  items: AnyResource[];
  total: number;
  loading: boolean;
  error?: string | null;
  sort: ResourceListSort;
  variant?: MarketplaceListVariant;
  emptyText?: string;
  chatEnabled?: boolean;
  dockTemplate?: AnyResource | null;
  onSearch?: (query: string) => void;
  onRetry?: () => void;
  onSortChange: (sort: ResourceListSort) => void;
  onClickItem: (item: AnyResource) => void;
  onUseTemplateInChat?: (item: AnyResource) => void;
  onUseTemplateInWorkbench?: (item: AnyResource) => void;
  onCloseChatDock?: () => void;
}) {
  const t = useTranslations('marketplace');
  const resources = items.map(
    (item) =>
      ({
        ...item,
        resourceType: SLUG_TO_RESOURCE_TYPE[slug],
      }) as AnyResource,
  );

  if (variant === 'desktop') {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <MarketplaceTopNav currentSlug={slug} />
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>
              {t(`resourceType.${TYPE_LABEL_KEY[slug]}`)}
              <span className="ml-2 text-sm" style={{ color: 'var(--muted)' }}>
                {t('list.totalCount', { count: total })}
              </span>
            </h1>
            <div className="flex items-center gap-2">
              {SORT_TABS.map((tab) => {
                const active = sort === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => onSortChange(tab.key)}
                    className="px-3 py-1 text-xs rounded transition-colors"
                    style={{
                      backgroundColor: active
                        ? 'var(--accent)'
                        : 'var(--panel-muted)',
                      color: active ? '#fff' : 'var(--muted)',
                    }}
                  >
                    {t(tab.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-16 text-sm" style={{ color: 'var(--muted)' }}>
              {t('common.loading')}
            </div>
          ) : (
            <ResourceGrid
              items={resources}
              onClickItem={onClickItem}
              columns={4}
              emptyText={emptyText}
            />
          )}
        </div>
      </div>
    );
  }

  const meta = TYPE_META[slug] ?? TYPE_META.agents;
  const Icon = meta.icon;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <MarketplaceTopNav currentSlug={slug} onSearch={onSearch} />
      <div className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,#020617_0%,#08111f_32%,var(--background)_100%)] px-4 py-5 sm:px-6">
        <div
          className="mb-5 overflow-hidden rounded-lg border border-white/12 bg-white/[0.075] p-5 text-white shadow-2xl backdrop-blur-xl"
          style={{ background: meta.background }}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/66">
                <Icon className="h-3.5 w-3.5" /> {t(meta.eyebrowKey)}
              </p>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                {t(`resourceType.${TYPE_LABEL_KEY[slug]}`)}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/62">
                {t(meta.descKey)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/16 bg-black/20 px-3 py-1.5 text-xs text-white/70">
                {t('list.totalCount', { count: total })}
              </span>
              {SORT_TABS.map((tab) => {
                const active = sort === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => onSortChange(tab.key)}
                    className={
                      active
                        ? 'rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-950 transition-transform hover:scale-[1.03]'
                        : 'rounded-full border border-white/14 bg-white/10 px-3 py-1.5 text-xs text-white/66 backdrop-blur-md transition-colors hover:text-white'
                    }
                  >
                    {t(tab.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-white/58">
            {t('common.loading')}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-sm text-white/58">{error}</p>
            <button
              onClick={onRetry}
              className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-slate-950 transition-transform hover:scale-[1.03]"
            >
              {t('common.retry')}
            </button>
          </div>
        ) : (
          <ResourceGrid
            items={resources}
            onClickItem={onClickItem}
            onUseTemplateInChat={onUseTemplateInChat}
            onUseTemplateInWorkbench={onUseTemplateInWorkbench}
            columns={4}
            layout="masonry"
            emptyText={emptyText}
          />
        )}
      </div>

      {chatEnabled && (
        <MarketplaceChatDock
          template={dockTemplate}
          resourceType={SLUG_TO_RESOURCE_TYPE[slug]}
          onClose={onCloseChatDock ?? (() => undefined)}
        />
      )}
    </div>
  );
}
