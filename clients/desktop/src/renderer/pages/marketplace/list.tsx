'use client';

import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MarketplaceTopNav, ResourceGrid } from '@autix/shared-ui/marketplace';
import { useResourceStore } from '@autix/shared-store';
import type { AnyResource, MarketplaceTypeSlug } from '@autix/shared-lib';

const TYPE_LABEL: Record<string, string> = {
  'image-templates': '图片模板',
  'video-templates': '视频模板',
  skills: 'Skills',
  mcp: 'MCP',
  agents: 'Agents',
};

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
  const { type } = useParams<{ type: string }>();
  const slug = (type ?? '') as MarketplaceTypeSlug;
  const isValid = useMemo(() => VALID.includes(slug), [slug]);

  const { items, total, loading, sort, setSort, fetchList } = useResourceStore();

  useEffect(() => {
    if (isValid) fetchList(slug);
  }, [slug, isValid, fetchList]);

  if (!isValid) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <MarketplaceTopNav currentSlug={slug} />
        <div
          className="flex-1 flex items-center justify-center"
          style={{ color: 'var(--muted)' }}
        >
          未知资源类型: {slug}
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
            {TYPE_LABEL[slug]}
            <span className="ml-2 text-sm" style={{ color: 'var(--muted)' }}>
              共 {total} 个
            </span>
          </h1>
          <div className="flex items-center gap-2">
            {(['newest', 'popular', 'likes'] as const).map((s) => {
              const active = sort === s;
              const label = s === 'newest' ? '最新' : s === 'popular' ? '热度' : '点赞';
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
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-sm" style={{ color: 'var(--muted)' }}>
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
            onClickItem={(item) => navigate(`/marketplace/${slug}/${item.id}`)}
            columns={4}
            emptyText="暂无资源"
          />
        )}
      </div>
    </div>
  );
}
