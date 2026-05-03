'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, Eye, ExternalLink, Heart, Monitor, Pin, Search, X } from 'lucide-react';
import {
  conversationResourcesApi,
  type MarketplaceTypeSlug,
  type ResourceType,
} from '@autix/shared-lib';
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
  likeCount?: number;
  runtimeRequirement?: 'CLOUD' | 'DESKTOP_ONLY' | 'EITHER';
  resourceType?: ResourceType;
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

  const activate = async () => {
    if (!selected || !conversationId) return;
    if (isTemplate) {
      router.push(`/marketplace/${type}/${selected.id}/workspace?conversationId=${conversationId}`);
      close();
      return;
    }
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div className="absolute inset-0 bg-black/20 pointer-events-auto" onClick={close} />
      <aside
        className={`absolute right-4 top-4 bottom-4 flex w-[min(420px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl shadow-2xl pointer-events-auto ${pinned ? 'ring-2 ring-[var(--accent)]' : ''}`}
        style={{
          backgroundColor: 'var(--panel)',
          border: '1px solid var(--border)',
        }}
      >
        <header className="flex items-center justify-between gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em]" style={{ color: 'var(--muted)' }}>
              资源面板
            </p>
            <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
              {selected ? titleOf(selected) : '添加到当前会话'}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded-lg p-2 hover:bg-[var(--panel-muted)]"
              onClick={() => setPinned(!pinned)}
              title={pinned ? '取消固定' : '固定面板'}
            >
              <Pin className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded-lg p-2 hover:bg-[var(--panel-muted)]"
              onClick={close}
              title="关闭"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {!selected ? (
          <>
            <div className="space-y-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex gap-1 overflow-x-auto">
                {MARKETPLACE_TYPES.map((slug) => (
                  <button
                    key={slug}
                    type="button"
                    onClick={() => {
                      setType(slug);
                      setSelectedId(null);
                    }}
                    className="flex-shrink-0 rounded-full px-3 py-1.5 text-sm"
                    style={{
                      backgroundColor: type === slug ? 'var(--accent)' : 'var(--panel-muted)',
                      color: type === slug ? '#fff' : 'var(--foreground)',
                    }}
                  >
                    {TYPE_LABEL[slug]}
                  </button>
                ))}
              </div>
              <label className="relative block">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-10 w-full rounded-xl bg-transparent pl-9 pr-3 text-sm outline-none"
                  style={{
                    border: '1px solid var(--input-border)',
                    color: 'var(--foreground)',
                  }}
                  placeholder="搜索资源..."
                />
              </label>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="py-12 text-center text-sm" style={{ color: 'var(--muted)' }}>
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
                className="mb-4 inline-flex items-center gap-1 text-sm"
                style={{ color: 'var(--muted)' }}
                onClick={() => setSelectedId(null)}
              >
                <ChevronLeft className="h-4 w-4" />
                返回列表
              </button>
              {detailLoading ? (
                <div className="py-12 text-center text-sm" style={{ color: 'var(--muted)' }}>
                  加载中...
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <RuntimeBadge level={runtimeOf(selected)} showReason />
                    <p className="text-sm leading-6" style={{ color: 'var(--muted)' }}>
                      {descriptionOf(selected) || '暂无描述'}
                    </p>
                    <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {pointsOf(selected) === 0 ? '免费' : `${pointsOf(selected)} 积分`}
                    </p>
                  </div>

                  {mode === 'electron' && resourceType === 'MCP' && (
                    <div className="rounded-xl p-3 text-sm" style={{ backgroundColor: 'var(--panel-muted)' }}>
                      MCP 本地状态：{status === 'ready' ? '已安装' : status === 'missing_env' ? '缺少环境变量' : status === 'failed' ? '检测失败' : '未安装'}
                    </div>
                  )}

                  {cannotRunOnWeb && (
                    <div className="rounded-xl p-3 text-sm" style={{ backgroundColor: 'var(--panel-muted)', color: 'var(--muted)' }}>
                      该资源需要桌面端本地环境，Web 端不能直接激活。
                    </div>
                  )}
                </div>
              )}
            </div>
            <footer className="flex items-center gap-2 px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={activate}
                disabled={busy || !conversationId || cannotRunOnWeb}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
              >
                <Check className="h-4 w-4" />
                {isTemplate ? '进入生成并回流' : busy ? '处理中...' : '获取并激活'}
              </button>
              <button
                type="button"
                onClick={() => router.push(`/marketplace/${type}/${selected.id}`)}
                className="rounded-xl p-2"
                style={{ border: '1px solid var(--border)' }}
                title="打开完整详情"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
            </footer>
          </div>
        )}
      </aside>
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

  return (
    <button
      type="button"
      className="group min-w-0 overflow-hidden rounded-xl text-left transition-all hover:ring-2 hover:ring-[var(--accent)]"
      style={{
        backgroundColor: 'var(--panel)',
        border: '1px solid var(--border)',
      }}
      onClick={onClick}
    >
      <div className="relative aspect-[4/3] overflow-hidden" style={{ backgroundColor: 'var(--panel-muted)' }}>
        <FallbackImage
          src={resource.coverImage ?? undefined}
          alt={resource.title ?? '资源'}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
          fallbackText="暂无封面"
        />
        <span
          className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{ backgroundColor: PANEL_TYPE_BADGE_COLOR[type], color: '#fff' }}
        >
          {PANEL_TYPE_LABEL[type]}
        </span>
        {desktopOnly && (
          <span
            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: '#7c3aed', color: '#fff' }}
          >
            <Monitor className="h-3 w-3" />
          </span>
        )}
      </div>
      <div className="space-y-1.5 p-2.5">
        <div className="truncate text-sm font-medium" style={{ color: 'var(--foreground)' }} title={resource.title}>
          {resource.title ?? '未命名资源'}
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px]"
            style={{
              backgroundColor: isFree ? '#22c55e' : 'var(--panel-muted)',
              color: isFree ? '#fff' : 'var(--muted)',
            }}
          >
            {isFree ? '免费' : `${resource.pointsCost} 积分`}
          </span>
          <span className="min-w-0 flex-1 truncate text-[10px]" style={{ color: 'var(--muted)' }}>
            {resource.category ?? ''}
          </span>
        </div>
        <div className="flex items-center justify-end gap-2 text-[10px]" style={{ color: 'var(--muted)' }}>
          <span className="inline-flex items-center gap-0.5">
            <Eye className="h-3 w-3" />
            {resource.useCount ?? 0}
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
