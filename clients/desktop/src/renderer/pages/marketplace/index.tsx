'use client';

import { useNavigate } from 'react-router-dom';
import {
  MarketplaceDesktopHomeView,
  marketplaceSlugForResource,
} from '@autix/shared-ui/marketplace';
import {
  useMarketplaceHomeController,
} from '@autix/shared-store';

export function MarketplaceHomePage() {
  const navigate = useNavigate();
  const { home, hotRanking, editorPicks, stats } = useMarketplaceHomeController();
  const hotRecommendations = home?.categories
    ? [
        ...(home.categories.skills ?? []),
        ...(home.categories.mcp ?? []),
        ...(home.categories.agents ?? []),
        ...(home.categories.imageTemplates ?? []),
        ...(home.categories.videoTemplates ?? []),
      ].slice(0, 12)
    : [];

  return (
    <MarketplaceDesktopHomeView
      hotRecommendations={hotRecommendations}
      hotRanking={hotRanking ?? []}
      editorPicks={editorPicks ?? []}
      stats={stats}
      onCategoryClick={(slug) => navigate(`/marketplace/${slug}`)}
      onResourceClick={(item) => {
        navigate(`/marketplace/${marketplaceSlugForResource(item)}/${item.id}`);
      }}
    />
  );
}
