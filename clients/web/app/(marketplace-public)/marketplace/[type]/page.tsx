'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  MarketplaceTopNav,
  ResourceGrid,
  MarketplaceChatDock,
  MARKETPLACE_ENABLED_SLUGS,
} from '@autix/shared-ui/marketplace';
import { useChatEnabled } from '@autix/shared-ui/hooks';
import { useResourceStore } from '@autix/shared-store';
import type { AnyResource, MarketplaceTypeSlug } from '@autix/shared-lib';
import { ResourceType } from '@/lib/resource-types';
import { Bot, ImageIcon, Video } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

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

const TYPE_META: Record<
  MarketplaceTypeSlug,
  {
    eyebrow: string;
    desc: string;
    icon: LucideIcon;
    accent: string;
    background: string;
  }
> = {
  agents: {
    eyebrow: 'AgentHub / 智能体',
    desc: '挑选可直接进入会话的智能体、工具链和工作流伙伴。',
    icon: Bot,
    accent: '#0ea5e9',
    background:
      'linear-gradient(115deg, rgba(14,165,233,0.28), rgba(6,182,212,0.12) 52%, rgba(15,23,42,0.74))',
  },
  'image-templates': {
    eyebrow: 'Image Recipes / 图片模板',
    desc: '浏览海报、商品图、封面与视觉风格模板，像作品墙一样快速挑选。',
    icon: ImageIcon,
    accent: '#22c55e',
    background:
      'linear-gradient(115deg, rgba(34,197,94,0.26), rgba(20,184,166,0.12) 52%, rgba(15,23,42,0.74))',
  },
  'video-templates': {
    eyebrow: 'Video Flows / 视频模板',
    desc: '从分镜、镜头参数到短视频生成流程，找到适合当前创作的起点。',
    icon: Video,
    accent: '#f97316',
    background:
      'linear-gradient(115deg, rgba(249,115,22,0.28), rgba(245,158,11,0.12) 52%, rgba(15,23,42,0.74))',
  },
  skills: {
    eyebrow: 'Skills',
    desc: '能力增强、个性化指令与可复用操作方式。',
    icon: Bot,
    accent: '#8b5cf6',
    background:
      'linear-gradient(115deg, rgba(139,92,246,0.26), rgba(14,165,233,0.12) 52%, rgba(15,23,42,0.74))',
  },
  mcp: {
    eyebrow: 'MCP',
    desc: '工具、数据源和外部连接器。',
    icon: Bot,
    accent: '#06b6d4',
    background:
      'linear-gradient(115deg, rgba(6,182,212,0.26), rgba(14,165,233,0.12) 52%, rgba(15,23,42,0.74))',
  },
};

export default function MarketplaceListPage() {
  const router = useRouter();
  const chatEnabled = useChatEnabled(false);
  const params = useParams<{ type: string }>();
  const searchParams = useSearchParams();
  const slug = (params?.type ?? '') as MarketplaceTypeSlug;
  const initialSearch = searchParams?.get('search') ?? '';
  const meta = TYPE_META[slug] ?? TYPE_META.agents;
  const Icon = meta.icon;

  const [dockTemplate, setDockTemplate] = useState<AnyResource | null>(null);

  const {
    items,
    total,
    loading,
    error,
    sort,
    search,
    setSort,
    setSearch,
    fetchList,
  } = useResourceStore();

  const isValid = useMemo(() => MARKETPLACE_ENABLED_SLUGS.includes(slug), [slug]);

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
        <div className="flex flex-1 items-center justify-center bg-[linear-gradient(180deg,#020617_0%,#08111f_100%)] text-white/58">
          未知资源类型: {slug}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <MarketplaceTopNav currentSlug={slug} onSearch={(q) => setSearch(q)} />
      <div className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,#020617_0%,#08111f_32%,var(--background)_100%)] px-4 py-5 sm:px-6">
        <div
          className="mb-5 overflow-hidden rounded-lg border border-white/12 bg-white/[0.075] p-5 text-white shadow-2xl backdrop-blur-xl"
          style={{ background: meta.background }}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/66">
                <Icon className="h-3.5 w-3.5" /> {meta.eyebrow}
              </p>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                {TYPE_LABEL[slug]}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/62">
                {meta.desc}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/16 bg-black/20 px-3 py-1.5 text-xs text-white/70">
                共 {total} 个
              </span>
              {SORT_TABS.map((s) => {
                const active = sort === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => setSort(s.key)}
                    className={
                      active
                        ? 'rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-950 transition-transform hover:scale-[1.03]'
                        : 'rounded-full border border-white/14 bg-white/10 px-3 py-1.5 text-xs text-white/66 backdrop-blur-md transition-colors hover:text-white'
                    }
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-white/58">
            加载中…
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-sm text-white/58">{error}</p>
            <button
              onClick={() => fetchList(slug)}
              className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-slate-950 transition-transform hover:scale-[1.03]"
            >
              重试
            </button>
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
            onUseTemplateInChat={
              chatEnabled && (slug === 'image-templates' || slug === 'video-templates')
                ? (item) => setDockTemplate(item)
                : undefined
            }
            onUseTemplateInWorkbench={
              (slug === 'image-templates' || slug === 'video-templates')
                ? (item) => {
                    router.push(
                      slug === 'video-templates'
                        ? `/workbench/video?templateId=${item.id}`
                        : `/workbench/image?templateId=${item.id}`,
                    );
                  }
                : undefined
            }
            columns={4}
            layout="masonry"
            emptyText="暂无资源,试试切换分类或换个关键词"
          />
        )}
      </div>

      {chatEnabled && (
        <MarketplaceChatDock
          template={dockTemplate}
          resourceType={RESOURCE_TYPE[slug] as any}
          onClose={() => setDockTemplate(null)}
        />
      )}
    </div>
  );
}
