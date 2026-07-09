'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MarketplaceCommunityView,
  marketplaceSlugForResource,
} from '@autix/shared-ui/marketplace';
import { useChatEnabled } from '@autix/shared-ui/hooks';
import {
  useMarketplaceHomeController,
  type AnyResource,
  type ResourceType,
} from '@autix/shared-store';

function withResourceType(items: AnyResource[], resourceType: ResourceType) {
  return items.map(
    (item) =>
      ({
        ...item,
        resourceType,
      }) as AnyResource,
  );
}

function interleaveTemplates(images: AnyResource[], videos: AnyResource[]) {
  const output: AnyResource[] = [];
  const max = Math.max(images.length, videos.length);
  for (let index = 0; index < max; index += 1) {
    if (videos[index]) output.push(videos[index]);
    if (images[index]) output.push(images[index]);
  }
  return output;
}

export function CommunityMarketplacePage() {
  const router = useRouter();
  const chatEnabled = useChatEnabled(false);
  const { home, loading, error, fetchHome, hotRanking, editorPicks } =
    useMarketplaceHomeController();
  const [dockTemplate, setDockTemplate] = useState<AnyResource | null>(null);

  const hotRecommendations = home
    ? interleaveTemplates(
        withResourceType(home.categories.imageTemplates ?? [], 'IMAGE_TEMPLATE'),
        withResourceType(home.categories.videoTemplates ?? [], 'VIDEO_TEMPLATE'),
      ).slice(0, 18)
    : [];

  const typedHotRanking = interleaveTemplates(
    withResourceType(
      hotRanking.filter((item) => marketplaceSlugForResource(item) === 'image-templates'),
      'IMAGE_TEMPLATE',
    ),
    withResourceType(
      hotRanking.filter((item) => marketplaceSlugForResource(item) === 'video-templates'),
      'VIDEO_TEMPLATE',
    ),
  );
  const typedEditorPicks = interleaveTemplates(
    withResourceType(
      editorPicks.filter((item) => marketplaceSlugForResource(item) === 'image-templates'),
      'IMAGE_TEMPLATE',
    ),
    withResourceType(
      editorPicks.filter((item) => marketplaceSlugForResource(item) === 'video-templates'),
      'VIDEO_TEMPLATE',
    ),
  );

  return (
    <MarketplaceCommunityView
      loading={loading}
      error={error && !home ? error : null}
      hotRecommendations={hotRecommendations}
      hotRanking={typedHotRanking}
      editorPicks={typedEditorPicks}
      chatEnabled={chatEnabled}
      dockTemplate={dockTemplate}
      onRetry={() => fetchHome()}
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
