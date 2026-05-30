'use client';

import { useEffect, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  MarketplaceTopNav,
  ResourceGrid,
} from '@autix/shared-ui/marketplace';
import { useResourceStore } from '@autix/shared-store';
import type { AnyResource, MarketplaceTypeSlug } from '@autix/shared-lib';
import { ResourceType } from '@/lib/resource-types';

const TYPE_LABEL: Record<MarketplaceTypeSlug, string> = {
  'image-templates': '图片模板',
  'video-templates': '视频模板',
  skills: 'Skills',
  mcp: 'MCP',
  agents: 'Agents',
};

const RESOURCE_TYPE: Record<MarketplaceTypeSlug, ResourceType> = {
  'image-templates': 'IMAGE_TEMPLATE',
  'video-templates': 'VIDEO_TEMPLATE',
  skills: 'SKILL',
  mcp: 'MCP',
  agents: 'AGENT',
};

const SORT_TABS: { key: 'newest' | 'popular' | 'likes'; label: string }[] = [
  { key: 'newest', label: '最新' },
  { key: 'popular', label: '热度' },
  { key: 'likes', label: '点赞' },
];

const VALID_SLUGS: MarketplaceTypeSlug[] = [
  'image-templates',
  'video-templates',
  // 暂时移除 mcp、skills 模板，专注图片与视频的 agents 开发
  // 'skills',
  // 'mcp',
  'agents',
];

export default function MarketplaceListPage() {
  const router = useRouter();
  const params = useParams<{ type: string }>();
  const searchParams = useSearchParams();
  const slug = (params?.type ?? '') as MarketplaceTypeSlug;
  const initialSearch = searchParams?.get('search') ?? '';

  const {
    items,
    total,
    loading,
    sort,
    search,
    setSort,
    setSearch,
    fetchList,
  } = useResourceStore();

  const isValid = useMemo(() => VALID_SLUGS.includes(slug), [slug]);

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
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          未知资源类型: {slug}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <MarketplaceTopNav currentSlug={slug} onSearch={(q) => setSearch(q)} />
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">
            {TYPE_LABEL[slug]}
            <span className="ml-2 text-sm text-muted-foreground">
              共 {total} 个
            </span>
          </h1>
          <div className="flex items-center gap-2">
            {SORT_TABS.map((s) => {
              const active = sort === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setSort(s.key)}
                  className={
                    active
                      ? 'rounded bg-primary px-3 py-1 text-xs text-primary-foreground transition-colors'
                      : 'rounded bg-muted px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/80'
                  }
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            加载中…
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
            columns={4}
            emptyText="暂无资源,试试切换分类或换个关键词"
          />
        )}
      </div>
    </div>
  );
}
