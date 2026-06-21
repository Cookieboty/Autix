'use client';

import { Check, ChevronLeft, Eye, ExternalLink, Heart, Monitor, Pin, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { MarketplaceTypeSlug, ResourceType } from '@autix/shared-store';
import { FallbackImage } from '../template/FallbackImage';
import { Button } from '../ui/button';
import { SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { cn } from '../ui/utils';
import { RuntimeBadge } from './RuntimeBadge';
import { MARKETPLACE_TYPES, TYPE_LABEL_KEY } from './resource-utils';
import {
  descriptionOf,
  type InstallStatus,
  type PanelMode,
  pointsOf,
  type ResourcePanelItem,
  runtimeOf,
} from './ResourcePanelHelpers';

const PANEL_TYPE_BADGE_COLOR: Record<ResourceType, string> = {
  SKILL: '#7c3aed',
  MCP: '#0891b2',
  AGENT: '#0ea5e9',
  IMAGE_TEMPLATE: '#22c55e',
  VIDEO_TEMPLATE: '#f59e0b',
};

const PANEL_TYPE_LABEL_KEY: Record<ResourceType, 'skill' | 'mcp' | 'agent' | 'imageTemplateShort' | 'videoTemplateShort'> = {
  SKILL: 'skill',
  MCP: 'mcp',
  AGENT: 'agent',
  IMAGE_TEMPLATE: 'imageTemplateShort',
  VIDEO_TEMPLATE: 'videoTemplateShort',
};

export function ResourcePanelHeader({
  selected,
  pinned,
  onTogglePinned,
}: {
  selected: ResourcePanelItem | null;
  pinned: boolean;
  onTogglePinned: () => void;
}) {
  const tPanel = useTranslations('marketplace.resourcePanel');

  return (
    <SheetHeader className="flex-row items-center justify-between gap-2 border-b border-border px-4 py-3">
      <div className="space-y-0.5">
        <SheetDescription className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {tPanel('eyebrow')}
        </SheetDescription>
        <SheetTitle className="text-base font-semibold">
          {selected ? selected.title ?? tPanel('resourceDetails') : tPanel('addToCurrentSession')}
        </SheetTitle>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onTogglePinned}
        aria-label={pinned ? tPanel('unpin') : tPanel('pin')}
        title={pinned ? tPanel('unpin') : tPanel('pin')}
      >
        <Pin className="h-4 w-4" />
      </Button>
    </SheetHeader>
  );
}

export function ResourcePanelList({
  type,
  items,
  loading,
  resourceType,
  search,
  onSearchChange,
  onSelectType,
  onSelectResource,
}: {
  type: MarketplaceTypeSlug;
  items: ResourcePanelItem[];
  loading: boolean;
  resourceType: ResourceType;
  search: string;
  onSearchChange: (search: string) => void;
  onSelectType: (type: MarketplaceTypeSlug) => void;
  onSelectResource: (item: ResourcePanelItem) => void;
}) {
  const t = useTranslations('marketplace');
  const tPanel = useTranslations('marketplace.resourcePanel');

  return (
    <>
      <div className="space-y-3 border-b border-border px-4 py-3">
        <div className="flex gap-1 overflow-x-auto">
          {MARKETPLACE_TYPES.map((slug) => (
            <button
              key={slug}
              type="button"
              onClick={() => onSelectType(slug)}
              className={cn(
                'flex-shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors',
                type === slug
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-foreground hover:bg-secondary/80',
              )}
            >
              {t(`resourceType.${TYPE_LABEL_KEY[slug]}`)}
            </button>
          ))}
        </div>
        <label className="relative block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-10 w-full rounded-xl border border-input bg-transparent pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            placeholder={tPanel('searchPlaceholder')}
          />
        </label>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <ResourcePanelLoading />
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {items.map((item) => (
              <ResourcePanelMiniCard
                key={item.id}
                resource={item}
                resourceType={resourceType}
                onClick={() => onSelectResource(item)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export function ResourcePanelDetail({
  selected,
  detailLoading,
  mode,
  resourceType,
  status,
  cannotRunOnWeb,
  isTemplate,
  chatEnabled,
  busy,
  conversationId,
  onBack,
  onActivate,
  onApplyTemplateToWorkbench,
  onOpenFullDetails,
}: {
  selected: ResourcePanelItem;
  detailLoading: boolean;
  mode: PanelMode;
  resourceType: ResourceType;
  status: InstallStatus;
  cannotRunOnWeb: boolean;
  isTemplate: boolean;
  chatEnabled: boolean;
  busy: boolean;
  conversationId?: string;
  onBack: () => void;
  onActivate: () => void;
  onApplyTemplateToWorkbench: () => void;
  onOpenFullDetails: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        <ResourcePanelBackButton onBack={onBack} />
        {detailLoading ? (
          <ResourcePanelLoading />
        ) : (
          <ResourcePanelDetailBody
            selected={selected}
            mode={mode}
            resourceType={resourceType}
            status={status}
            cannotRunOnWeb={cannotRunOnWeb}
          />
        )}
      </div>
      <ResourcePanelActionBar
        isTemplate={isTemplate}
        chatEnabled={chatEnabled}
        busy={busy}
        cannotRunOnWeb={cannotRunOnWeb}
        conversationId={conversationId}
        onActivate={onActivate}
        onApplyTemplateToWorkbench={onApplyTemplateToWorkbench}
        onOpenFullDetails={onOpenFullDetails}
      />
    </div>
  );
}

function ResourcePanelDetailBody({
  selected,
  mode,
  resourceType,
  status,
  cannotRunOnWeb,
}: {
  selected: ResourcePanelItem;
  mode: PanelMode;
  resourceType: ResourceType;
  status: InstallStatus;
  cannotRunOnWeb: boolean;
}) {
  const t = useTranslations('marketplace');
  const tPanel = useTranslations('marketplace.resourcePanel');

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <RuntimeBadge level={runtimeOf(selected)} showReason />
        <p className="text-sm leading-6 text-muted-foreground">
          {descriptionOf(selected) || t('common.noDescription')}
        </p>
        <p className="text-sm font-medium text-foreground">
          {pointsOf(selected) === 0
            ? t('common.free')
            : t('common.pointsCost', { points: pointsOf(selected) })}
        </p>
      </div>

      <ResourcePanelSourceInfo selected={selected} />

      {mode === 'electron' && resourceType === 'MCP' && (
        <div className="rounded-xl bg-secondary p-3 text-sm text-foreground">
          {tPanel('mcpLocalStatus')}
          {status === 'ready'
            ? tPanel('statusReady')
            : status === 'missing_env'
              ? tPanel('statusMissingEnv')
              : status === 'failed'
                ? tPanel('statusFailed')
                : tPanel('statusNotInstalled')}
        </div>
      )}

      {cannotRunOnWeb && (
        <div className="rounded-xl bg-secondary p-3 text-sm text-muted-foreground">
          {tPanel('desktopOnlyWebBlocked')}
        </div>
      )}
    </div>
  );
}

function ResourcePanelSourceInfo({ selected }: { selected: ResourcePanelItem }) {
  const tPanel = useTranslations('marketplace.resourcePanel');

  if (
    !selected.originalUrl &&
    !selected.authorName &&
    !selected.sourcePlatform &&
    !selected.externalId
  ) {
    return null;
  }

  return (
    <div className="space-y-1.5 border-t border-border pt-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {tPanel('sourceInfo')}
      </p>
      {selected.authorName && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">{tPanel('author')}</span>
          {selected.authorUrl ? (
            <a
              href={selected.authorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-blue-500 hover:underline"
            >
              {selected.authorName}
            </a>
          ) : (
            <span className="truncate text-foreground">
              {selected.authorName}
            </span>
          )}
        </div>
      )}
      {selected.sourcePlatform && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">{tPanel('platform')}</span>
          <span className="truncate text-foreground">
            {selected.sourcePlatform}
          </span>
        </div>
      )}
      {selected.externalId && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">{tPanel('externalId')}</span>
          <span className="truncate font-mono text-foreground">
            {selected.externalId}
          </span>
        </div>
      )}
      {selected.originalUrl && (
        <a
          href={selected.originalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline"
        >
          {tPanel('viewOriginal')}
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

function ResourcePanelActionBar({
  isTemplate,
  chatEnabled,
  busy,
  cannotRunOnWeb,
  conversationId,
  onActivate,
  onApplyTemplateToWorkbench,
  onOpenFullDetails,
}: {
  isTemplate: boolean;
  chatEnabled: boolean;
  busy: boolean;
  cannotRunOnWeb: boolean;
  conversationId?: string;
  onActivate: () => void;
  onApplyTemplateToWorkbench: () => void;
  onOpenFullDetails: () => void;
}) {
  const t = useTranslations('marketplace');
  const tPanel = useTranslations('marketplace.resourcePanel');

  return (
    <div className="flex items-center gap-2 border-t border-border px-4 py-3">
      {isTemplate ? (
        <>
          {chatEnabled && (
            <Button
              type="button"
              onClick={onActivate}
              disabled={busy || cannotRunOnWeb || !conversationId}
              className="min-w-0 flex-1 rounded-xl"
            >
              <Check className="h-4 w-4" />
              {t('card.useInChat')}
            </Button>
          )}
          <Button
            type="button"
            variant={chatEnabled ? 'outline' : 'default'}
            onClick={onApplyTemplateToWorkbench}
            disabled={cannotRunOnWeb}
            className="min-w-0 flex-1 rounded-xl"
          >
            <ExternalLink className="h-4 w-4" />
            {t('card.useInWorkbench')}
          </Button>
        </>
      ) : (
        <Button
          type="button"
          onClick={onActivate}
          disabled={busy || cannotRunOnWeb || !conversationId}
          className="flex-1 rounded-xl"
        >
          <Check className="h-4 w-4" />
          {busy ? tPanel('processing') : tPanel('acquireAndActivate')}
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={onOpenFullDetails}
        className="rounded-xl"
        title={tPanel('openFullDetails')}
        aria-label={tPanel('openFullDetails')}
      >
        <ExternalLink className="h-4 w-4" />
      </Button>
    </div>
  );
}

function ResourcePanelBackButton({ onBack }: { onBack: () => void }) {
  const tPanel = useTranslations('marketplace.resourcePanel');

  return (
    <button
      type="button"
      className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      onClick={onBack}
    >
      <ChevronLeft className="h-4 w-4" />
      {tPanel('backToList')}
    </button>
  );
}

function ResourcePanelLoading() {
  const tPanel = useTranslations('marketplace.resourcePanel');

  return (
    <div className="py-12 text-center text-sm text-muted-foreground">
      {tPanel('loading')}
    </div>
  );
}

function ResourcePanelMiniCard({
  resource,
  resourceType,
  onClick,
}: {
  resource: ResourcePanelItem;
  resourceType: ResourceType;
  onClick: () => void;
}) {
  const type = resource.resourceType ?? resourceType;
  const isFree = (resource.pointsCost ?? 0) === 0;
  const desktopOnly = resource.runtimeRequirement === 'DESKTOP_ONLY';
  const t = useTranslations('marketplace');

  return (
    <button
      type="button"
      className="group min-w-0 overflow-hidden rounded-xl border border-border bg-card text-left transition-all hover:ring-2 hover:ring-primary"
      onClick={onClick}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <FallbackImage
          src={resource.coverImage ?? undefined}
          alt={resource.title ?? t('common.resource')}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
          fallbackText={t('common.noCover')}
        />
        <span
          className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
          style={{ backgroundColor: PANEL_TYPE_BADGE_COLOR[type] }}
        >
          {t(`resourceType.${PANEL_TYPE_LABEL_KEY[type]}`)}
        </span>
        {desktopOnly && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
            <Monitor className="h-3 w-3" />
          </span>
        )}
      </div>
      <div className="space-y-1.5 p-2.5">
        <div
          className="truncate text-sm font-medium text-foreground"
          title={resource.title}
        >
          {resource.title ?? t('common.untitledResource')}
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={
              'flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ' +
              (isFree
                ? 'bg-green-500 text-white'
                : 'bg-muted text-muted-foreground')
            }
          >
            {isFree ? t('common.free') : t('common.pointsCost', { points: resource.pointsCost ?? 0 })}
          </span>
          <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">
            {resource.category ?? ''}
          </span>
        </div>
        <div className="flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-0.5">
            <Eye className="h-3 w-3" />
            {resource.viewCount ?? 0}
          </span>
          <span className="inline-flex items-center gap-0.5">
            <Heart className="h-3 w-3" />
            {resource.likeCount ?? 0}
          </span>
        </div>
      </div>
    </button>
  );
}
