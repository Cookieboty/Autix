'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  marketplaceActions,
  type MarketplaceTypeSlug,
  useResourcePanelStore,
  useResourceStore,
} from '@autix/shared-store';
import { useChatEnabled } from '../hooks/useModelConfigEnabled';
import { useRouter } from '../navigation';
import { Sheet, SheetContent } from '../ui/sheet';
import { cn } from '../ui/utils';
import { SLUG_TO_RESOURCE_TYPE } from './resource-utils';
import {
  desktopResources,
  dispatchResourceChanged,
  getInstallStatus,
  isAcquirable,
  type InstallStatus,
  type PanelMode,
  type ResourcePanelItem,
  runtimeOf,
} from './ResourcePanelHelpers';
import {
  ResourcePanelDetail,
  ResourcePanelHeader,
  ResourcePanelList,
} from './ResourcePanelParts';

export function ResourcePanel({
  conversationId,
  mode = 'web',
  open: controlledOpen,
  pinned: controlledPinned,
  onClose,
}: {
  conversationId?: string;
  mode?: PanelMode;
  open?: boolean;
  pinned?: boolean;
  onClose?: () => void;
}) {
  const router = useRouter();
  const storeOpen = useResourcePanelStore((s) => s.open);
  const storePinned = useResourcePanelStore((s) => s.pinned);
  const setPinned = useResourcePanelStore((s) => s.setPinned);
  const closePanel = useResourcePanelStore((s) => s.closePanel);
  const initialType = useResourcePanelStore((s) => s.initialType);
  const initialResourceId = useResourcePanelStore((s) => s.initialResourceId);
  const [type, setType] = useState<MarketplaceTypeSlug>(initialType ?? 'skills');
  const [selectedId, setSelectedId] = useState<string | null>(initialResourceId ?? null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<InstallStatus>('not_installed');
  const chatEnabled = useChatEnabled(false);
  const {
    items,
    loading,
    currentResource,
    detailLoading,
    search,
    setSearch,
    fetchList,
    fetchDetail,
    acquire,
  } = useResourceStore();

  const open = controlledOpen ?? storeOpen;
  const pinned = controlledPinned ?? storePinned;
  const resourceType = SLUG_TO_RESOURCE_TYPE[type];
  const isTemplate = type === 'image-templates' || type === 'video-templates';
  const desktopOnly = runtimeOf(currentResource);
  const cannotRunOnWeb = desktopOnly === 'DESKTOP_ONLY' && mode === 'web';

  useEffect(() => {
    if (!initialType) return;
    setType(initialType);
  }, [initialType]);

  useEffect(() => {
    if (!open) return;
    void fetchList(type, 1);
  }, [fetchList, open, type]);

  useEffect(() => {
    if (!open || !initialResourceId) return;
    setSelectedId(initialResourceId);
    void fetchDetail(type, initialResourceId);
  }, [fetchDetail, initialResourceId, open, type]);

  useEffect(() => {
    if (!currentResource || mode !== 'electron') return;
    void getInstallStatus(resourceType, currentResource.id).then(setStatus);
  }, [currentResource, mode, resourceType]);

  const selected = useMemo(
    () => (selectedId ? (currentResource as ResourcePanelItem | null) : null),
    [currentResource, selectedId],
  );

  const close = () => {
    onClose?.();
    closePanel();
    setSelectedId(null);
  };

  const selectType = (nextType: MarketplaceTypeSlug) => {
    setType(nextType);
    setSelectedId(null);
  };

  const selectResource = (item: ResourcePanelItem) => {
    setSelectedId(item.id);
    void fetchDetail(type, item.id);
  };

  const applyTemplateToWorkbench = () => {
    if (!selected) return;
    router.push(
      type === 'image-templates'
        ? `/workbench/image?templateId=${selected.id}`
        : `/workbench/video?templateId=${selected.id}`,
    );
    close();
  };

  const activate = async () => {
    if (!selected) return;
    if (isTemplate) {
      if (!conversationId) return;
      router.push(`/marketplace/${type}/${selected.id}/workspace?conversationId=${conversationId}`);
      close();
      return;
    }
    if (!conversationId) return;
    if (cannotRunOnWeb) return;
    setBusy(true);
    try {
      if (isAcquirable(type)) {
        await acquire(type as 'skills' | 'mcp' | 'agents', selected.id);
      }
      const resources = desktopResources();
      if (mode === 'electron' && resources && resourceType !== 'IMAGE_TEMPLATE' && resourceType !== 'VIDEO_TEMPLATE') {
        await resources.install({
          type: resourceType as 'SKILL' | 'MCP' | 'AGENT',
          id: selected.id,
          payload: selected,
        });
        setStatus(await getInstallStatus(resourceType, selected.id));
      }
      await marketplaceActions.attachConversationResource(
        conversationId,
        resourceType,
        selected.id,
      );
      dispatchResourceChanged();
      if (!pinned) close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <SheetContent
        side="right"
        className={cn(
          'flex w-[min(420px,calc(100vw-32px))] flex-col gap-0 p-0 sm:max-w-none',
          pinned && 'ring-2 ring-primary',
        )}
      >
        <ResourcePanelHeader
          selected={selected}
          pinned={pinned}
          onTogglePinned={() => setPinned(!pinned)}
        />

        {!selected ? (
          <ResourcePanelList
            type={type}
            items={items as ResourcePanelItem[]}
            loading={loading}
            resourceType={resourceType}
            search={search}
            onSearchChange={setSearch}
            onSelectType={selectType}
            onSelectResource={selectResource}
          />
        ) : (
          <ResourcePanelDetail
            selected={selected}
            detailLoading={detailLoading}
            mode={mode}
            resourceType={resourceType}
            status={status}
            cannotRunOnWeb={cannotRunOnWeb}
            isTemplate={isTemplate}
            chatEnabled={chatEnabled}
            busy={busy}
            conversationId={conversationId}
            onBack={() => setSelectedId(null)}
            onActivate={activate}
            onApplyTemplateToWorkbench={applyTemplateToWorkbench}
            onOpenFullDetails={() => router.push(`/marketplace/${type}/${selected.id}`)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
