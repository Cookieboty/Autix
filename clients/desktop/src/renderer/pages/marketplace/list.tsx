'use client';

import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import {
  MarketplaceListView,
  MarketplaceRouteState,
  MARKETPLACE_TYPES,
} from '@autix/shared-ui/marketplace';
import {
  useResourceListController,
  type MarketplaceTypeSlug,
  type ResourceListSort,
} from '@autix/shared-store';

export function MarketplaceListPage() {
  const navigate = useNavigate();
  const t = useTranslations('marketplace');
  const { type } = useParams<{ type: string }>();
  const slug = (type ?? '') as MarketplaceTypeSlug;
  const isValid = useMemo(() => MARKETPLACE_TYPES.includes(slug), [slug]);

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
      <MarketplaceRouteState currentSlug={slug} tone="desktop-muted">
        {t('common.unknownResourceType', { slug })}
      </MarketplaceRouteState>
    );
  }

  return (
    <MarketplaceListView
      slug={slug}
      items={items}
      total={total}
      loading={loading}
      sort={sort}
      variant="desktop"
      emptyText={t('common.emptyResources')}
      onSortChange={setSort}
      onClickItem={(item) => navigate(`/marketplace/${slug}/${item.id}`)}
    />
  );
}
