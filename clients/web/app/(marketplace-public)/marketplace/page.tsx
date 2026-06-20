'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MarketplaceHomeView,
  marketplaceSlugForResource,
} from '@autix/shared-ui/marketplace';
import { useChatEnabled } from '@autix/shared-ui/hooks';
import { useMarketplaceHomeController } from '@autix/shared-store';
import type { AnyResource } from '@autix/shared-store';

export default function MarketplaceHomePage() {
  const router = useRouter();
  const chatEnabled = useChatEnabled(false);
  const { home, loading, error, fetchHome, hotRanking, editorPicks, stats } =
    useMarketplaceHomeController();
  const [dockTemplate, setDockTemplate] = useState<AnyResource | null>(null);

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
    <MarketplaceHomeView
      loading={loading}
      error={error && !home ? error : null}
      hotRecommendations={hotRecommendations}
      hotRanking={hotRanking}
      editorPicks={editorPicks}
      stats={stats}
      chatEnabled={chatEnabled}
      dockTemplate={dockTemplate}
      onRetry={() => fetchHome()}
      onSearch={(q) => {
        // 暂时移除 mcp、skills、agents 模板，专注图片与视频模板
        // if (q) router.push(`/marketplace/skills?search=${encodeURIComponent(q)}`);
        if (q) router.push(`/marketplace/image-templates?search=${encodeURIComponent(q)}`);
      }}
      onCategoryClick={(slug) => router.push(`/marketplace/${slug}`)}
      onResourceClick={(item) => {
        router.push(`/marketplace/${marketplaceSlugForResource(item)}/${item.id}`);
      }}
      onUseTemplateInChat={chatEnabled ? (item) => setDockTemplate(item) : undefined}
      onUseTemplateInWorkbench={(item) => {
        const slug = marketplaceSlugForResource(item);
        router.push(
          slug === 'video-templates'
            ? `/workbench/video?templateId=${item.id}`
            : `/workbench/image?templateId=${item.id}`,
        );
      }}
      onCloseChatDock={() => setDockTemplate(null)}
    />
  );
}
