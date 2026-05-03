'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  MarketplaceTopNav,
  ResourceGrid,
  HotRankingList,
  EditorPicks,
  PlatformStats,
} from '@autix/shared-ui';
import { useMarketplaceStore } from '@autix/shared-store';
import {
  Sparkles,
  Wrench,
  Bot,
  ImageIcon,
  Video,
} from 'lucide-react';

const CATEGORY_CARDS = [
  {
    slug: 'skills',
    title: 'Skills',
    desc: '能力增强、个性化指令',
    icon: Sparkles,
    color: '#7c3aed',
  },
  {
    slug: 'mcp',
    title: 'MCP',
    desc: '工具/数据源连接器',
    icon: Wrench,
    color: '#0891b2',
  },
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
        ...home.categories.skills.slice(0, 2),
        ...home.categories.mcp.slice(0, 1),
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
          if (q) router.push(`/marketplace/skills?search=${encodeURIComponent(q)}`);
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
                Skills · MCP · Agents · 图片/视频模板 一站获取,一键激活到会话
              </p>
            </section>

            <section>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {CATEGORY_CARDS.map((c) => {
                  const Icon = c.icon;
                  return (
                    <button
                      key={c.slug}
                      onClick={() => router.push(`/marketplace/${c.slug}`)}
                      className="rounded-lg p-4 text-left transition-transform hover:-translate-y-0.5 hover:shadow-lg"
                      style={{
                        backgroundColor: 'var(--panel)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                        style={{ backgroundColor: c.color, color: '#fff' }}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div
                        className="font-semibold text-sm"
                        style={{ color: 'var(--foreground)' }}
                      >
                        {c.title}
                      </div>
                      <div
                        className="text-xs mt-1"
                        style={{ color: 'var(--muted)' }}
                      >
                        {c.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-3">
                <h2
                  className="font-semibold text-base"
                  style={{ color: 'var(--foreground)' }}
                >
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
