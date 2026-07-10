'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import {
  MarketplaceListView,
  MarketplaceRouteState,
  MARKETPLACE_ENABLED_SLUGS,
} from '@autix/shared-ui/marketplace';
import { useChatEnabled } from '@autix/shared-ui/hooks';
import {
  useResourceListController,
  type AnyResource,
  type MarketplaceTypeSlug,
  type ResourceListSort,
} from '@autix/shared-store';

export default function MarketplaceListPageContent() {
  const router = useRouter();
  const t = useTranslations('marketplace');
  const chatEnabled = useChatEnabled(false);
  const params = useParams<{ type: string }>();
  const searchParams = useSearchParams();
  const slug = (params?.type ?? '') as MarketplaceTypeSlug;
  const initialSearch = searchParams?.get('search') ?? '';

  const [dockTemplate, setDockTemplate] = useState<AnyResource | null>(null);
  const [sort, setSort] = useState<ResourceListSort>('newest');
  const [search, setSearch] = useState(initialSearch);

  const isValid = useMemo(() => MARKETPLACE_ENABLED_SLUGS.includes(slug), [slug]);
  const { items, total, loading, error, fetchList } = useResourceListController(
    {
      slug,
      search,
      sort,
      page: 1,
      pageSize: 20,
    },
    isValid,
  );

  useEffect(() => {
    if (!isValid) return;
    setSearch(initialSearch);
  }, [initialSearch, isValid, slug]);

  if (!isValid) {
    return (
      <MarketplaceRouteState currentSlug={slug} tone="public-list">
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
      error={error}
      sort={sort}
      emptyText={t('list.emptyResources')}
      chatEnabled={chatEnabled}
      dockTemplate={dockTemplate}
      onSearch={(q) => setSearch(q)}
      onRetry={() => fetchList()}
      onSortChange={setSort}
      onClickItem={(item) => router.push(`/marketplace/${slug}/${item.id}`)}
      onUseTemplateInChat={
        chatEnabled && (slug === 'image-templates' || slug === 'video-templates')
          ? (item) => setDockTemplate(item)
          : undefined
      }
      onUseTemplateInWorkbench={
        slug === 'image-templates' || slug === 'video-templates'
          ? (item) => {
              router.push(
                slug === 'video-templates'
                  ? `/workbench/video?templateId=${item.id}`
                  : `/workbench/image?templateId=${item.id}`,
              );
            }
          : undefined
      }
      onCloseChatDock={() => setDockTemplate(null)}
    />
  );
}
