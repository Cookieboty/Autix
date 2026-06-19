'use client';

import { Plus, Store } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { MarketplaceTypeSlug } from '@autix/shared-lib';
import { useResourcePanelStore, type ResourcePanelSource } from '@autix/shared-store';

export function ResourceLauncher({
  conversationId,
  type,
  resourceId,
  source = 'chat',
  label,
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
  const t = useTranslations('chat.resourceLauncher');
  const resolvedLabel = label ?? t('addResource');

  return (
    <button
      type="button"
      onClick={() => openPanel({ type, resourceId, conversationId, source })}
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-foreground border border-border bg-transparent hover:bg-card transition-colors"
      title={t('openPanel')}
    >
      {compact ? <Store className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      <span>{resolvedLabel}</span>
    </button>
  );
}
