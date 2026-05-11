'use client';

import { Plus, Store } from 'lucide-react';
import type { MarketplaceTypeSlug } from '@autix/shared-lib';
import { useResourcePanelStore, type ResourcePanelSource } from '@autix/shared-store';

export function ResourceLauncher({
  conversationId,
  type,
  resourceId,
  source = 'chat',
  label = '+ Add Resource',
  compact = false,
}: {
  conversationId?: string;
  type?: MarketplaceTypeSlug;
  resourceId?: string;
  source?: ResourcePanelSource;
  label?: string;
  compact?: boolean;
}) {
  const openPanel = useResourcePanelStore((s) => s.openPanel);

  return (
    <button
      type="button"
      onClick={() => openPanel({ type, resourceId, conversationId, source })}
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-foreground border border-border bg-transparent hover:bg-card transition-colors"
      title="打开资源面板"
    >
      {compact ? <Store className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      <span>{label}</span>
    </button>
  );
}
