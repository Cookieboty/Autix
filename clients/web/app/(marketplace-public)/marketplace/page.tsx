'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  MarketplaceTopNav,
  ResourceGrid,
  HotRankingList,
  EditorPicks,
  PlatformStats,
} from '@autix/shared-ui/marketplace';
import { useMarketplaceStore } from '@autix/shared-store';
import {
  // 暂时移除 mcp、skills、agents 模板，专注图片与视频模板
  // Sparkles,
  // Wrench,
  ArrowRight,
  ImageIcon,
  Play,
  Sparkles,
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
            <section className="relative overflow-hidden rounded-lg border border-white/12 bg-white/[0.075] p-5 shadow-2xl backdrop-blur-xl sm:p-7">
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(115deg, rgba(14,165,233,0.26) 0%, rgba(34,197,94,0.12) 44%, rgba(249,115,22,0.22) 100%)',
                }}
              />
              <div className="absolute inset-x-0 top-0 h-px bg-white/30" />
              <div className="relative grid gap-7 xl:grid-cols-[1fr_0.78fr]">
                <div className="flex min-h-[300px] flex-col justify-between gap-8">
                  <div>
                    <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/72 backdrop-blur-md">
                      <Sparkles className="h-3.5 w-3.5" /> Template Market
                    </p>
                    <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight text-white md:text-6xl">
                      资源模板市场
                    </h1>
                    <p className="mt-4 max-w-2xl text-sm leading-7 text-white/68 md:text-base">
                      汇聚可直接激活的图片模板与视频模板，从灵感、提示词到工作流，一键带入会话创作。
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => router.push('/marketplace/image-templates')}
                      className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition-transform hover:scale-[1.03]"
                    >
                      探索图片模板 <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => router.push('/marketplace/video-templates')}
                      className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-medium text-white backdrop-blur-md transition-transform hover:scale-[1.03]"
                    >
                      <Play className="h-4 w-4" /> 视频模板
                    </button>
                  </div>
                </div>

                <div className="grid min-h-[300px] gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  {CATEGORY_CARDS.map((c, index) => {
                    const Icon = c.icon;
                    return (
                      <button
                        key={c.slug}
                        onClick={() => router.push(`/marketplace/${c.slug}`)}
                        className="group relative min-h-[92px] overflow-hidden rounded-lg border border-white/12 bg-black/22 p-4 text-left backdrop-blur-md transition-transform hover:-translate-y-1"
                      >
                        <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${c.accent}`} />
                        <div className="relative flex items-center gap-4">
                          <span
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-white shadow-lg transition-transform group-hover:scale-105"
                            style={{ backgroundColor: c.color }}
                          >
                            <Icon className="h-5 w-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-white">
                              {c.title}
                            </span>
                            <span className="mt-1 line-clamp-2 block text-xs leading-5 text-white/58">
                              {c.desc}
                            </span>
                          </span>
                          <span className="hidden text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-white/36 sm:block">
                            0{index + 1}
                            <br />
                            {c.metric}
                          </span>
                        </div>
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
