'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MarketplaceTopNav,
  ResourceGrid,
  MarketplaceChatDock,
  HotRankingList,
  EditorPicks,
  PlatformStats,
} from '@autix/shared-ui/marketplace';
import { useMarketplaceStore } from '@autix/shared-store';
import type { AnyResource } from '@autix/shared-lib';
import {
  // 暂时移除 mcp、skills、agents 模板，专注图片与视频模板
  // Sparkles,
  // Wrench,
  ArrowRight,
  ImageIcon,
  Video,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const CATEGORY_CARDS = [
  // 暂时移除 mcp、skills、agents 模板，专注图片与视频模板
  // {
  //   slug: 'skills',
  //   title: 'Skills',
  //   desc: '能力增强、个性化指令',
  //   icon: Sparkles,
  //   color: '#7c3aed',
  // },
  // {
  //   slug: 'mcp',
  //   title: 'MCP',
  //   desc: '工具/数据源连接器',
  //   icon: Wrench,
  //   color: '#0891b2',
  // },
  // {
  //   slug: 'agents',
  //   title: 'Agents',
  //   desc: '工具链智能体、工作流和创作伙伴',
  //   icon: Bot,
  //   color: '#0ea5e9',
  //   accent: 'from-sky-400 to-cyan-300',
  //   metric: 'AgentHub',
  // },
  {
    slug: 'image-templates',
    title: '图片模板',
    desc: '封面、海报、商品图与视觉风格配方',
    icon: ImageIcon,
    color: '#22c55e',
    accent: 'from-emerald-400 to-lime-300',
    metric: 'Image',
  },
  {
    slug: 'video-templates',
    title: '视频模板',
    desc: '分镜脚本、镜头参数和成片工作流',
    icon: Video,
    color: '#f59e0b',
    accent: 'from-orange-400 to-amber-200',
    metric: 'Video',
  },
] satisfies {
  slug: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  color: string;
  accent: string;
  metric: string;
}[];

export default function MarketplaceHomePage() {
  const router = useRouter();
  const { home, loading, error, fetchHome, hotRanking, editorPicks, stats } =
    useMarketplaceStore();
  const [dockTemplate, setDockTemplate] = useState<AnyResource | null>(null);

  useEffect(() => {
    fetchHome();
  }, [fetchHome]);

  const visibleHotRanking = hotRanking
    .filter((item) => (item as { resourceType?: string }).resourceType !== 'AGENT')
    .slice(0, 5);
  const visibleEditorPicks = editorPicks
    .filter((item) => (item as { resourceType?: string }).resourceType !== 'AGENT')
    .slice(0, 4);

  const hotRecommendations = home
    ? [
      // 暂时移除 mcp、skills、agents 模板，专注图片与视频模板
      // ...home.categories.skills.slice(0, 2),
      // ...home.categories.mcp.slice(0, 1),
      // ...home.categories.agents.slice(0, 1),
      ...home.categories.imageTemplates.slice(0, 1),
      ...home.categories.videoTemplates.slice(0, 1),
    ]
    : [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <MarketplaceTopNav
        currentSlug=""
        onSearch={(q) => {
          // 暂时移除 mcp、skills、agents 模板，专注图片与视频模板
          // if (q) router.push(`/marketplace/skills?search=${encodeURIComponent(q)}`);
          if (q) router.push(`/marketplace/image-templates?search=${encodeURIComponent(q)}`);
        }}
      />
      <div className="flex-1 overflow-y-auto">
        {error && !home && !loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-[linear-gradient(180deg,#020617_0%,#08111f_100%)] text-center">
            <p className="text-sm text-white/58">{error}</p>
            <button
              onClick={() => fetchHome()}
              className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-slate-950 transition-transform hover:scale-[1.03]"
            >
              重试
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
                    模板市场
                  </h1>
                  <p className="mt-1 text-xs leading-5 text-white/58 sm:text-sm">
                    图片与视频创作模板，一键带入会话
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {CATEGORY_CARDS.map((c) => {
                    const CIcon = c.icon;
                    return (
                      <button
                        key={c.slug}
                        onClick={() => router.push(`/marketplace/${c.slug}`)}
                        className="group inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/8 px-4 py-2 text-xs font-medium text-white backdrop-blur-md transition-all hover:scale-[1.03] hover:border-white/24 hover:bg-white/14"
                      >
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-md text-white"
                          style={{ backgroundColor: c.color }}
                        >
                          <CIcon className="h-3.5 w-3.5" />
                        </span>
                        {c.title}
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
                  热门推荐瀑布流
                </h2>
                <span className="text-xs text-white/46">
                  图片 · 视频
                </span>
              </div>
              <ResourceGrid
                items={hotRecommendations}
                onClickItem={(item) => {
                  const t = (
                    item as unknown as {
                      resourceType: keyof typeof TYPE_TO_SLUG;
                    }
                  ).resourceType;
                  router.push(`/marketplace/${TYPE_TO_SLUG[t]}/${item.id}`);
                }}
                onUseTemplate={(item) => setDockTemplate(item)}
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

      <MarketplaceChatDock
        template={dockTemplate}
        resourceType={((dockTemplate as any)?.resourceType ?? 'IMAGE_TEMPLATE') as any}
        onClose={() => setDockTemplate(null)}
      />
    </div>
  );
}

const TYPE_TO_SLUG = {
  IMAGE_TEMPLATE: 'image-templates',
  VIDEO_TEMPLATE: 'video-templates',
  SKILL: 'skills',
  MCP: 'mcp',
  AGENT: 'agents',
} as const;
