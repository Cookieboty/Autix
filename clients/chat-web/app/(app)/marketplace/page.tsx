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
  // 暂时移除 mcp、skills 模板，专注图片与视频的 agents 开发
  // Sparkles,
  // Wrench,
  Bot,
  ImageIcon,
  Video,
} from 'lucide-react';

const CATEGORY_CARDS = [
  // 暂时移除 mcp、skills 模板，专注图片与视频的 agents 开发
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
  {
    slug: 'agents',
    title: 'Agents',
    desc: '具备完整工具链的智能体',
    icon: Bot,
    color: '#0ea5e9',
  },
  {
    slug: 'image-templates',
    title: '图片模板',
    desc: '一键产出风格化图像',
    icon: ImageIcon,
    color: '#22c55e',
  },
  {
    slug: 'video-templates',
    title: '视频模板',
    desc: '短视频脚本与生成',
    icon: Video,
    color: '#f59e0b',
  },
];

export default function MarketplaceHomePage() {
  const router = useRouter();
  const { home, fetchHome, hotRanking, editorPicks, stats } =
    useMarketplaceStore();

  useEffect(() => {
    fetchHome();
  }, [fetchHome]);

  const hotRecommendations = home
    ? [
      // 暂时移除 mcp、skills 模板，专注图片与视频的 agents 开发
      // ...home.categories.skills.slice(0, 2),
      // ...home.categories.mcp.slice(0, 1),
      ...home.categories.agents.slice(0, 1),
      ...home.categories.imageTemplates.slice(0, 1),
      ...home.categories.videoTemplates.slice(0, 1),
    ]
    : [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <MarketplaceTopNav
        currentSlug=""
        onSearch={(q) => {
          // 暂时移除 mcp、skills 模板，专注图片与视频的 agents 开发
          // if (q) router.push(`/marketplace/skills?search=${encodeURIComponent(q)}`);
          if (q) router.push(`/marketplace/agents?search=${encodeURIComponent(q)}`);
        }}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-12 gap-6 px-6 py-6">
          <div className="col-span-12 lg:col-span-9 space-y-8">
            <section
              className="rounded-xl p-8 text-white"
              style={{
                background:
                  'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #ec4899 100%)',
              }}
            >
              <h1 className="text-3xl font-bold mb-2">
                一站式 AI 资源模板市场
              </h1>
              <p className="opacity-90">
                {/* 暂时移除 mcp、skills 模板，专注图片与视频的 agents 开发 */}
                {/* Skills · MCP · Agents · 图片/视频模板 一站获取,一键激活到会话 */}
                Agents · 图片/视频模板 一站获取,一键激活到会话
              </p>
            </section>

            <section>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {CATEGORY_CARDS.map((c) => {
                  const Icon = c.icon;
                  return (
                    <button
                      key={c.slug}
                      onClick={() => router.push(`/marketplace/${c.slug}`)}
                      className="rounded-lg border border-border bg-card p-4 text-left transition-transform hover:-translate-y-0.5 hover:shadow-lg"
                    >
                      <div
                        className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg text-white"
                        style={{ backgroundColor: c.color }}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="text-sm font-semibold text-foreground">
                        {c.title}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {c.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-foreground">
                  热门推荐
                </h2>
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
              />
            </section>
          </div>

          <aside className="col-span-12 lg:col-span-3 space-y-4">
            <HotRankingList items={hotRanking.slice(0, 5)} />
            <EditorPicks items={editorPicks.slice(0, 4)} />
            <PlatformStats stats={stats} />
          </aside>
        </div>
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
