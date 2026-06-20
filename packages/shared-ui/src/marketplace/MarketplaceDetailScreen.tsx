'use client';

import { MarketplaceTopNav } from './MarketplaceTopNav';
import {
  ResourceDetailView,
  type ResourceDetailViewProps,
} from './ResourceDetailView';

export function MarketplaceDetailScreen(props: ResourceDetailViewProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <MarketplaceTopNav currentSlug={props.slug} />
      <ResourceDetailView {...props} />
    </div>
  );
}
