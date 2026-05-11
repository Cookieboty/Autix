'use client';

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MarketplaceTopNav,
  ResourceGrid,
  HotRankingList,
  EditorPicks,
  PlatformStats,
} from '@autix/shared-ui/marketplace';
import { useMarketplaceStore } from '@autix/shared-store';

const CATEGORY_LABEL = [
  { key: 'skills', label: 'Skills' },
  { key: 'mcp', label: 'MCP' },
  { key: 'agents', label: 'Agents' },
  { key: 'image-templates', label: '图片模板' },
  { key: 'video-templates', label: '视频模板' },
];

export function MarketplaceHomePage() {
  const navigate = useNavigate();
  const { home, fetchHome, hotRanking, editorPicks, stats } = useMarketplaceStore();

  useEffect(() => {
    fetchHome();
  }, [fetchHome]);

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
            <h1 className="text-xl font-bold">一站式 AI 资源模板市场</h1>
            <p className="mt-1 text-sm opacity-90">
              发现并使用 Skills、MCP、Agents、图片/视频模板
            </p>
          </section>

          <div className="grid grid-cols-5 gap-3">
            {CATEGORY_LABEL.map((c) => (
              <button
                key={c.key}
                onClick={() => navigate(`/marketplace/${c.key}`)}
                className="px-4 py-3 rounded-lg text-sm font-medium transition-colors hover:bg-[var(--panel-muted)]"
                style={{
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--panel)',
                  color: 'var(--foreground)',
                }}
              >
                {c.label}
              </button>
            ))}
          </div>

          {home?.categories && (
            <section>
              <h2
                className="text-sm font-semibold mb-3"
                style={{ color: 'var(--foreground)' }}
              >
                热门推荐
              </h2>
              <ResourceGrid
                items={[
                  ...(home.categories.skills ?? []),
                  ...(home.categories.mcp ?? []),
                  ...(home.categories.agents ?? []),
                  ...(home.categories.imageTemplates ?? []),
                  ...(home.categories.videoTemplates ?? []),
                ].slice(0, 12)}
                columns={3}
                onClickItem={(item) => {
                  const slug =
                    item.resourceType === 'SKILL'
                      ? 'skills'
                      : item.resourceType === 'MCP'
                        ? 'mcp'
                        : item.resourceType === 'AGENT'
                          ? 'agents'
                          : item.resourceType === 'IMAGE_TEMPLATE'
                            ? 'image-templates'
                            : 'video-templates';
                  navigate(`/marketplace/${slug}/${item.id}`);
                }}
              />
            </section>
          )}
        </div>
        <aside className="col-span-3 space-y-4">
          <HotRankingList items={hotRanking ?? []} />
          <EditorPicks items={editorPicks ?? []} />
          {stats && <PlatformStats stats={stats} />}
        </aside>
      </div>
    </div>
  );
}
