'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  MarketplaceTopNav,
  ResourceGrid,
  MarketplaceChatDock,
  MARKETPLACE_ENABLED_SLUGS,
  TYPE_LABEL_KEY,
} from '@autix/shared-ui/marketplace';
import { useChatEnabled } from '@autix/shared-ui/hooks';
import { useResourceStore } from '@autix/shared-store';
import type { AnyResource, MarketplaceTypeSlug } from '@autix/shared-store';
import { ResourceType } from '@/lib/resource-types';
import { Bot, ImageIcon, Video } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const RESOURCE_TYPE: Record<MarketplaceTypeSlug, ResourceType> = {
  'image-templates': 'IMAGE_TEMPLATE',
  'video-templates': 'VIDEO_TEMPLATE',
  skills: 'SKILL',
  mcp: 'MCP',
  agents: 'AGENT',
};

const SORT_TABS: { key: 'newest' | 'popular' | 'likes'; labelKey: string }[] = [
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

export default function MarketplaceListPage() {
  const router = useRouter();
  const t = useTranslations('marketplace');
  const chatEnabled = useChatEnabled(false);
  const params = useParams<{ type: string }>();
  const searchParams = useSearchParams();
  const slug = (params?.type ?? '') as MarketplaceTypeSlug;
  const initialSearch = searchParams?.get('search') ?? '';
  const meta = TYPE_META[slug] ?? TYPE_META.agents;
  const Icon = meta.icon;

  const [dockTemplate, setDockTemplate] = useState<AnyResource | null>(null);

  const {
    items,
    total,
    loading,
    error,
    sort,
    search,
    setSort,
    setSearch,
    fetchList,
  } = useResourceStore();

  const isValid = useMemo(() => MARKETPLACE_ENABLED_SLUGS.includes(slug), [slug]);

  useEffect(() => {
    if (!isValid) return;
    if (initialSearch && initialSearch !== search) {
      setSearch(initialSearch);
    } else {
      fetchList(slug);
    }
  }, [slug, isValid]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isValid) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <MarketplaceTopNav currentSlug={slug} />
        <div className="flex flex-1 items-center justify-center bg-[linear-gradient(180deg,#020617_0%,#08111f_100%)] text-white/58">
          {t('common.unknownResourceType', { slug })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <MarketplaceTopNav currentSlug={slug} onSearch={(q) => setSearch(q)} />
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
              {SORT_TABS.map((s) => {
                const active = sort === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => setSort(s.key)}
                    className={
                      active
                        ? 'rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-950 transition-transform hover:scale-[1.03]'
                        : 'rounded-full border border-white/14 bg-white/10 px-3 py-1.5 text-xs text-white/66 backdrop-blur-md transition-colors hover:text-white'
                    }
                  >
                    {t(s.labelKey)}
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
              onClick={() => fetchList(slug)}
              className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-slate-950 transition-transform hover:scale-[1.03]"
            >
              {t('common.retry')}
            </button>
          </div>
        ) : (
          <ResourceGrid
            items={items.map(
              (it) =>
                ({
                  ...it,
                  resourceType: RESOURCE_TYPE[slug],
                }) as unknown as AnyResource,
            )}
            onClickItem={(item) => router.push(`/marketplace/${slug}/${item.id}`)}
            onUseTemplateInChat={
              chatEnabled && (slug === 'image-templates' || slug === 'video-templates')
                ? (item) => setDockTemplate(item)
                : undefined
            }
            onUseTemplateInWorkbench={
              (slug === 'image-templates' || slug === 'video-templates')
                ? (item) => {
                    router.push(
                      slug === 'video-templates'
                        ? `/workbench/video?templateId=${item.id}`
                        : `/workbench/image?templateId=${item.id}`,
                    );
                  }
                : undefined
            }
            columns={4}
            layout="masonry"
            emptyText={t('list.emptyResources')}
          />
        )}
      </div>

      {chatEnabled && (
        <MarketplaceChatDock
          template={dockTemplate}
          resourceType={RESOURCE_TYPE[slug] as any}
          onClose={() => setDockTemplate(null)}
        />
      )}
    </div>
  );
}
