'use client';

import { MarketplaceChatDockView } from './MarketplaceChatDockView';
import type { MarketplaceChatDockProps } from './marketplace-chat-dock-types';
import { useMarketplaceChatDockController } from './useMarketplaceChatDockController';

export function MarketplaceChatDock(props: MarketplaceChatDockProps) {
  const controller = useMarketplaceChatDockController(props);
  if (!controller) return null;

  return <MarketplaceChatDockView {...controller} />;
}
