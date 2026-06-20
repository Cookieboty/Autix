'use client';

import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { MarketplaceTopNav, ResourceGrid, TYPE_LABEL_KEY } from '@autix/shared-ui/marketplace';
import {
  useResourceListController,
  type AnyResource,
  type MarketplaceTypeSlug,
  type ResourceListSort,
} from '@autix/shared-store';

const RESOURCE_TYPE: Record<string, string> = {
  'image-templates': 'IMAGE_TEMPLATE',
  'video-templates': 'VIDEO_TEMPLATE',
  skills: 'SKILL',
  mcp: 'MCP',
  agents: 'AGENT',
};

const VALID: MarketplaceTypeSlug[] = [
  'image-templates',
  'video-templates',
  'skills',
  'mcp',
  'agents',
];

export function MarketplaceListPage() {
  const navigate = useNavigate();
  const t = useTranslations('marketplace');
  const { type } = useParams<{ type: string }>();
  const slug = (type ?? '') as MarketplaceTypeSlug;
  const isValid = useMemo(() => VALID.includes(slug), [slug]);

  const [sort, setSort] = useState<ResourceListSort>('newest');
  const { items, total, loading } = useResourceListController(
    {
      slug,
      sort,
      page: 1,
      pageSize: 20,
    },
    isValid,
  );

  if (!isValid) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <MarketplaceTopNav currentSlug={slug} />
        <div
          className="flex-1 flex items-center justify-center"
          style={{ color: 'var(--muted)' }}
        >
          {t('common.unknownResourceType', { slug })}
        </div>
      </div>
    );
  }

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
            {(['newest', 'popular', 'likes'] as const).map((s) => {
              const active = sort === s;
              const labelKey =
                s === 'newest'
                  ? 'list.sortNewest'
                  : s === 'popular'
                    ? 'list.sortPopular'
                    : 'list.sortLikes';
              return (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className="px-3 py-1 text-xs rounded transition-colors"
                  style={{
                    backgroundColor: active
                      ? 'var(--accent)'
                      : 'var(--panel-muted)',
                    color: active ? '#fff' : 'var(--muted)',
                  }}
                >
                  {t(labelKey)}
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
            items={items.map(
              (it) =>
                ({
                  ...it,
                  resourceType: RESOURCE_TYPE[slug],
                }) as unknown as AnyResource,
            )}
            onClickItem={(item) => navigate(`/marketplace/${slug}/${item.id}`)}
            columns={4}
            emptyText={t('common.emptyResources')}
          />
        )}
      </div>
    </div>
  );
}
