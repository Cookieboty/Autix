'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, Eye, ExternalLink, Heart, Monitor, Pin, Search } from 'lucide-react';
import {
  conversationResourcesApi,
  type MarketplaceTypeSlug,
  type ResourceType,
} from '@autix/shared-lib';
import { useChatEnabled } from '../hooks/useModelConfigEnabled';
import { useResourcePanelStore, useResourceStore } from '@autix/shared-store';
import { useRouter } from '../navigation';
import { FallbackImage } from '../template/FallbackImage';
import { RuntimeBadge } from './RuntimeBadge';
import {
  ACQUIRABLE_SLUGS,
  MARKETPLACE_TYPES,
  SLUG_TO_RESOURCE_TYPE,
  TYPE_LABEL,
} from './resource-utils';
import { Button } from '../ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';
import { cn } from '../ui/utils';

type PanelMode = 'web' | 'electron';

type InstallStatus = 'not_installed' | 'missing_env' | 'ready' | 'failed';

type ResourcePanelItem = {
  id: string;
  title?: string;
  category?: string | null;
  coverImage?: string | null;
  description?: string | null;
  pointsCost?: number;
  useCount?: number;
  viewCount?: number;
  likeCount?: number;
  runtimeRequirement?: 'CLOUD' | 'DESKTOP_ONLY' | 'EITHER';
  resourceType?: ResourceType;
  originalUrl?: string | null;
  authorName?: string | null;
  authorUrl?: string | null;
  sourcePlatform?: string | null;
  externalId?: string | null;
};

type DesktopResourcesApi = {
  install(input: {
    type: 'SKILL' | 'MCP' | 'AGENT';
    id: string;
    payload: unknown;
  }): Promise<{ ok: true; path: string }>;
  listInstalled(): Promise<
    Array<{
      type: 'SKILL' | 'MCP' | 'AGENT';
      id: string;
      path: string;
      manifest?: Record<string, unknown>;
    }>
  >;
  status?(input: {
    type: 'SKILL' | 'MCP' | 'AGENT';
    id: string;
  }): Promise<{
    status: InstallStatus;
    path?: string;
    missingEnv?: string[];
  }>;
};

function desktopResources(): DesktopResourcesApi | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { amux?: { resources?: DesktopResourcesApi } }).amux?.resources;
}

function isAcquirable(slug: MarketplaceTypeSlug) {
  return ACQUIRABLE_SLUGS.has(slug);
}

function titleOf(resource: ResourcePanelItem | null) {
  return resource?.title ?? '资源详情';
}

function descriptionOf(resource: ResourcePanelItem | null) {
  return resource?.description ?? '';
}

function pointsOf(resource: ResourcePanelItem | null) {
  return resource?.pointsCost ?? 0;
}

function runtimeOf(resource: ResourcePanelItem | null) {
  return resource?.runtimeRequirement ?? 'CLOUD';
}

const PANEL_TYPE_BADGE_COLOR: Record<ResourceType, string> = {
  SKILL: '#7c3aed',
  MCP: '#0891b2',
  AGENT: '#0ea5e9',
  IMAGE_TEMPLATE: '#22c55e',
  VIDEO_TEMPLATE: '#f59e0b',
};

const PANEL_TYPE_LABEL: Record<ResourceType, string> = {
  SKILL: 'Skill',
  MCP: 'MCP',
  AGENT: 'Agent',
  IMAGE_TEMPLATE: '图片',
  VIDEO_TEMPLATE: '视频',
};

function dispatchResourceChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('conversation-resources:changed'));
}

async function getInstallStatus(resourceType: ResourceType, resourceId: string): Promise<InstallStatus> {
  const resources = desktopResources();
  if (!resources) return 'not_installed';
  try {
    if (resourceType !== 'IMAGE_TEMPLATE' && resourceType !== 'VIDEO_TEMPLATE' && resources.status) {
      const res = await resources.status({
        type: resourceType as 'SKILL' | 'MCP' | 'AGENT',
        id: resourceId,
      });
      return res.status;
    }
    const installed = await resources.listInstalled();
    const item = installed.find((it) => it.type === resourceType && it.id === resourceId);
    if (!item) return 'not_installed';
    const manifest = item.manifest as { envSchema?: Record<string, string> } | undefined;
    const envSchema = manifest?.envSchema;
    if (envSchema && Object.keys(envSchema).length > 0) return 'missing_env';
    return 'ready';
  } catch {
    return 'failed';
  }
}

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
  const desktopOnly = runtimeOf(currentResource) === 'DESKTOP_ONLY';
  const cannotRunOnWeb = desktopOnly && mode === 'web';

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
    () => (selectedId ? currentResource : null),
    [currentResource, selectedId],
  );

  const close = () => {
    onClose?.();
    closePanel();
    setSelectedId(null);
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
      await conversationResourcesApi.attach(conversationId, resourceType, selected.id);
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
        <SheetHeader className="flex-row items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="space-y-0.5">
            <SheetDescription className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              资源面板
            </SheetDescription>
            <SheetTitle className="text-base font-semibold">
              {selected ? titleOf(selected) : '添加到当前会话'}
            </SheetTitle>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setPinned(!pinned)}
            aria-label={pinned ? '取消固定' : '固定面板'}
            title={pinned ? '取消固定' : '固定面板'}
          >
            <Pin className="h-4 w-4" />
          </Button>
        </SheetHeader>

        {!selected ? (
          <>
            <div className="space-y-3 border-b border-border px-4 py-3">
              <div className="flex gap-1 overflow-x-auto">
                {MARKETPLACE_TYPES.map((slug) => (
                  <button
                    key={slug}
                    type="button"
                    onClick={() => {
                      setType(slug);
                      setSelectedId(null);
                    }}
                    className={cn(
                      'flex-shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors',
                      type === slug
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-foreground hover:bg-secondary/80',
                    )}
                  >
                    {TYPE_LABEL[slug]}
                  </button>
                ))}
              </div>
              <label className="relative block">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-10 w-full rounded-xl border border-input bg-transparent pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  placeholder="搜索资源..."
                />
              </label>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  加载中...
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {(items as ResourcePanelItem[]).map((item) => (
                    <ResourcePanelMiniCard
                      key={item.id}
                      resource={item}
                      resourceType={resourceType}
                      onClick={() => {
                        setSelectedId(item.id);
                        void fetchDetail(type, item.id);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto p-4">
              <button
                type="button"
                className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setSelectedId(null)}
              >
                <ChevronLeft className="h-4 w-4" />
                返回列表
              </button>
              {detailLoading ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  加载中...
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <RuntimeBadge level={runtimeOf(selected)} showReason />
                    <p className="text-sm leading-6 text-muted-foreground">
                      {descriptionOf(selected) || '暂无描述'}
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {pointsOf(selected) === 0
                        ? '免费'
                        : `${pointsOf(selected)} 积分`}
                    </p>
                  </div>

                  {(selected.originalUrl ||
                    selected.authorName ||
                    selected.sourcePlatform ||
                    selected.externalId) && (
                    <div className="space-y-1.5 border-t border-border pt-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        来源信息
                      </p>
                      {selected.authorName && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">作者</span>
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
                          <span className="text-muted-foreground">平台</span>
                          <span className="truncate text-foreground">
                            {selected.sourcePlatform}
                          </span>
                        </div>
                      )}
                      {selected.externalId && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">外部 ID</span>
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
                          查看原文
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  )}

                  {mode === 'electron' && resourceType === 'MCP' && (
                    <div className="rounded-xl bg-secondary p-3 text-sm text-foreground">
                      MCP 本地状态：
                      {status === 'ready'
                        ? '已安装'
                        : status === 'missing_env'
                          ? '缺少环境变量'
                          : status === 'failed'
                            ? '检测失败'
                            : '未安装'}
                    </div>
                  )}

                  {cannotRunOnWeb && (
                    <div className="rounded-xl bg-secondary p-3 text-sm text-muted-foreground">
                      该资源需要桌面端本地环境，Web 端不能直接激活。
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 border-t border-border px-4 py-3">
              {isTemplate ? (
                <>
                  {chatEnabled && (
                    <Button
                      type="button"
                      onClick={activate}
                      disabled={busy || cannotRunOnWeb || !conversationId}
                      className="min-w-0 flex-1 rounded-xl"
                    >
                      <Check className="h-4 w-4" />
                      会话使用
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant={chatEnabled ? 'outline' : 'default'}
                    onClick={applyTemplateToWorkbench}
                    disabled={cannotRunOnWeb}
                    className="min-w-0 flex-1 rounded-xl"
                  >
                    <ExternalLink className="h-4 w-4" />
                    专业工作台
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  onClick={activate}
                  disabled={busy || cannotRunOnWeb || !conversationId}
                  className="flex-1 rounded-xl"
                >
                  <Check className="h-4 w-4" />
                  {busy ? '处理中...' : '获取并激活'}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => router.push(`/marketplace/${type}/${selected.id}`)}
                className="rounded-xl"
                title="打开完整详情"
                aria-label="打开完整详情"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
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

  return (
    <button
      type="button"
      className="group min-w-0 overflow-hidden rounded-xl border border-border bg-card text-left transition-all hover:ring-2 hover:ring-primary"
      onClick={onClick}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <FallbackImage
          src={resource.coverImage ?? undefined}
          alt={resource.title ?? '资源'}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
          fallbackText="暂无封面"
        />
        <span
          className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
          style={{ backgroundColor: PANEL_TYPE_BADGE_COLOR[type] }}
        >
          {PANEL_TYPE_LABEL[type]}
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
          {resource.title ?? '未命名资源'}
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
            {isFree ? '免费' : `${resource.pointsCost} 积分`}
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
