'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  MarketplaceTopNav,
  RuntimeBadge,
  useIsElectron,
  FallbackImage,
  ResourceGrid,
  Button,
} from '@autix/shared-ui';
import { Heart, Eye, ChevronRight, Monitor } from 'lucide-react';
import {
  imageTemplateApi,
  videoTemplateApi,
  skillApi,
  mcpApi,
  agentApi,
  acquisitionsApi,
  conversationResourcesApi,
  type AnyResource,
  type ImageTemplate,
  type VideoTemplate,
  type Skill,
  type McpServer,
  type AgentResource,
  type MarketplaceTypeSlug,
} from '@autix/shared-lib';
import { useChatStore } from '@/store/chat.store';
import { SLUG_TO_TYPE, ACQUIRABLE_SLUGS } from '@/lib/resource-types';

const VALID_SLUGS: MarketplaceTypeSlug[] = [
  'image-templates',
  'video-templates',
  'skills',
  'mcp',
  'agents',
];

const TYPE_LABEL: Record<MarketplaceTypeSlug, string> = {
  'image-templates': '图片模板',
  'video-templates': '视频模板',
  skills: 'Skill',
  mcp: 'MCP',
  agents: 'Agent',
};

const APIS = {
  'image-templates': imageTemplateApi,
  'video-templates': videoTemplateApi,
  skills: skillApi,
  mcp: mcpApi,
  agents: agentApi,
} as const;

type AnyResourceItem =
  | ImageTemplate
  | VideoTemplate
  | Skill
  | McpServer
  | AgentResource;

export default function ResourceDetailPage() {
  const router = useRouter();
  const params = useParams<{ type: string; id: string }>();
  const slug = (params?.type ?? '') as MarketplaceTypeSlug;
  const id = params?.id ?? '';
  const isElectron = useIsElectron();
  const { sessions, activeSessionId, createSession } = useChatStore();

  const [resource, setResource] = useState<AnyResourceItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [acquired, setAcquired] = useState(false);
  const [acquiring, setAcquiring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showActivate, setShowActivate] = useState(false);

  const isValid = useMemo(() => VALID_SLUGS.includes(slug), [slug]);

  useEffect(() => {
    if (!isValid) return;
    let cancelled = false;
    setLoading(true);
    APIS[slug]
      .getById(id)
      .then((res) => {
        if (cancelled) return;
        setResource(res.data as AnyResourceItem);
      })
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [slug, id, isValid]);

  if (!isValid) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <MarketplaceTopNav currentSlug={slug} />
        <div
          className="flex-1 flex items-center justify-center"
          style={{ color: 'var(--muted)' }}
        >
          未知资源类型: {slug}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <MarketplaceTopNav currentSlug={slug} />
        <div
          className="flex-1 flex items-center justify-center"
          style={{ color: 'var(--muted)' }}
        >
          加载中…
        </div>
      </div>
    );
  }

  if (!resource) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <MarketplaceTopNav currentSlug={slug} />
        <div className="flex-1 flex items-center justify-center text-sm text-red-500">
          {error ?? '资源不存在'}
        </div>
      </div>
    );
  }

  const type = SLUG_TO_TYPE[slug];
  const isFree = resource.pointsCost === 0;
  const desktopOnly = resource.runtimeRequirement === 'DESKTOP_ONLY';
  const desktopBlocked = desktopOnly && !isElectron;
  const isAcquirable = ACQUIRABLE_SLUGS.includes(slug);

  // ── 主按钮文案 ────────────────────────────────────────────────────
  let primaryLabel = '获取并激活到当前会话';
  if (slug === 'image-templates' || slug === 'video-templates') {
    primaryLabel = '立即生成并回流会话';
  } else if (!acquired && !isFree) {
    primaryLabel = `使用 ${resource.pointsCost} 积分获取并激活`;
  }

  if (desktopBlocked) {
    primaryLabel = '在桌面端获取';
  }

  // ── 主按钮行为 ────────────────────────────────────────────────────
  async function handlePrimary() {
    if (desktopBlocked) return;

    if (slug === 'image-templates') {
      router.push(`/marketplace/image-templates/${id}/workspace${activeSessionId ? `?conversationId=${activeSessionId}` : ''}`);
      return;
    }
    if (slug === 'video-templates') {
      router.push(`/marketplace/video-templates/${id}/workspace${activeSessionId ? `?conversationId=${activeSessionId}` : ''}`);
      return;
    }

    setAcquiring(true);
    setError(null);
    try {
      if (!acquired) {
        await acquisitionsApi.acquire(slug as 'skills' | 'mcp' | 'agents', id);
        setAcquired(true);
        const amux = (window as unknown as { amux?: { resources?: { install: (p: unknown) => Promise<unknown> } } }).amux;
        if (amux?.resources?.install) {
          try {
            await amux.resources.install({
              type,
              id,
              payload: resource,
            });
          } catch (e) {
            console.warn('[acquire] 本地安装失败,仍可云端使用:', e);
          }
        }
      }
      if (slug === 'mcp' && !isElectron) {
        setError('MCP 资源需在桌面端启用');
        return;
      }
      const convId = activeSessionId ?? (await createSession('新会话'));
      await conversationResourcesApi.attach(convId, type, id);
      window.dispatchEvent(new CustomEvent('conversation-resources:changed'));
      router.push(`/c/${convId}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAcquiring(false);
    }
  }

  async function activateTo(conversationId: string | 'new') {
    let convId = conversationId;
    if (convId === 'new') {
      convId = await createSession('新会话');
    }
    if (!acquired && isAcquirable) {
      await acquisitionsApi.acquire(slug as 'skills' | 'mcp' | 'agents', id);
      setAcquired(true);
    }
    await conversationResourcesApi.attach(convId, type, id);
    window.dispatchEvent(new CustomEvent('conversation-resources:changed'));
    router.push(`/c/${convId}`);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <MarketplaceTopNav currentSlug={slug} />

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <nav
          className="flex items-center gap-2 text-sm mb-4"
          style={{ color: 'var(--muted)' }}
        >
          <button onClick={() => router.push(`/marketplace/${slug}`)}>
            {TYPE_LABEL[slug]}
          </button>
          <ChevronRight className="w-3 h-3" />
          <span style={{ color: 'var(--foreground)' }}>{resource.title}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div
            className="col-span-1 lg:col-span-7 rounded-lg overflow-hidden"
            style={{
              backgroundColor: 'var(--panel)',
              border: '1px solid var(--border)',
            }}
          >
            <div
              className="aspect-[4/3]"
              style={{ backgroundColor: 'var(--panel-muted)' }}
            >
              <FallbackImage
                src={resource.coverImage}
                alt={resource.title}
                className="w-full h-full object-cover"
                fallbackText="暂无封面"
              />
            </div>
          </div>

          <aside
            className="col-span-1 lg:col-span-5 rounded-lg p-5 flex flex-col"
            style={{
              backgroundColor: 'var(--panel)',
              border: '1px solid var(--border)',
            }}
          >
            <h1
              className="text-xl font-bold mb-1"
              style={{ color: 'var(--foreground)' }}
            >
              {resource.title}
            </h1>
            <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
              by {resource.authorId}
            </p>

            <div className="flex items-center gap-2 mb-4">
              <span
                className="text-sm font-medium px-3 py-1 rounded-full"
                style={{
                  backgroundColor: isFree ? '#22c55e' : 'var(--panel-muted)',
                  color: isFree ? '#fff' : 'var(--foreground)',
                }}
              >
                {isFree ? '免费' : `${resource.pointsCost} 积分`}
              </span>
              <RuntimeBadge
                level={resource.runtimeRequirement}
                reason={resource.runtimeReason ?? null}
              />
            </div>

            {resource.description && (
              <p
                className="text-sm mb-4 leading-relaxed"
                style={{ color: 'var(--muted)' }}
              >
                {resource.description}
              </p>
            )}

            <Button
              
              disabled={desktopBlocked || acquiring}
              onClick={handlePrimary}
              className="w-full"
            >
              {acquiring ? '处理中…' : primaryLabel}
            </Button>

            {isAcquirable && !desktopBlocked && (
              <Button
                variant="outline"
                onClick={() => setShowActivate(true)}
                className="w-full mt-2"
              >
                选择会话
              </Button>
            )}

            {desktopBlocked && (
              <div
                className="mt-3 p-3 rounded text-xs space-y-1"
                style={{ backgroundColor: 'var(--panel-muted)' }}
              >
                <div className="flex items-center gap-1 font-medium">
                  <Monitor className="w-3 h-3" />
                  为什么仅桌面端?
                </div>
                <p style={{ color: 'var(--muted)' }}>
                  {resource.runtimeReason ?? '该资源需要本地运行环境'}
                </p>
              </div>
            )}

            {error && (
              <div className="mt-3 text-xs text-red-500">{error}</div>
            )}

            <div
              className="flex items-center gap-3 mt-auto pt-4 border-t"
              style={{
                borderColor: 'var(--border)',
                color: 'var(--muted)',
              }}
            >
              <span className="flex items-center gap-1 text-xs">
                <Eye className="w-3 h-3" />
                {resource.useCount}
              </span>
              <span className="flex items-center gap-1 text-xs">
                <Heart className="w-3 h-3" />
                {resource.likeCount}
              </span>
            </div>
          </aside>
        </div>

        <div className="mt-6">
          <div
            className="rounded-lg p-5"
            style={{
              backgroundColor: 'var(--panel)',
              border: '1px solid var(--border)',
            }}
          >
            <h2
              className="text-sm font-semibold mb-3"
              style={{ color: 'var(--foreground)' }}
            >
              资源信息
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <Info label="类型" value={TYPE_LABEL[slug]} />
              <Info label="分类" value={resource.category} />
              <Info label="版本" value={`v${resource.version}`} />
              <Info
                label="更新时间"
                value={new Date(resource.updatedAt).toLocaleDateString()}
              />
            </div>
          </div>
        </div>

        {isAcquirable && showActivate && (
          <ActivateDialog
            sessions={sessions.slice(0, 5).map((s) => ({ id: s.id, title: s.title }))}
            onSelect={activateTo}
            onClose={() => setShowActivate(false)}
          />
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: 'var(--muted)' }}>{label}</div>
      <div style={{ color: 'var(--foreground)' }}>{value}</div>
    </div>
  );
}

function ActivateDialog({
  sessions,
  onSelect,
  onClose,
}: {
  sessions: { id: string; title: string }[];
  onSelect: (id: string | 'new') => void | Promise<void>;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-[420px] rounded-lg p-6 space-y-4"
        style={{
          backgroundColor: 'var(--panel)',
          border: '1px solid var(--border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold">激活到</h3>
        <button
          onClick={() => onSelect('new')}
          className="w-full text-left px-3 py-2 rounded text-sm transition-colors hover:bg-[var(--panel-muted)]"
          style={{ border: '1px solid var(--border)' }}
        >
          + 新建会话并激活
        </button>
        {sessions.length > 0 && (
          <div className="space-y-1">
            <div
              className="text-[11px] uppercase font-medium"
              style={{ color: 'var(--muted)' }}
            >
              最近会话
            </div>
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => onSelect(s.id)}
                className="w-full text-left px-3 py-2 text-sm rounded transition-colors hover:bg-[var(--panel-muted)] truncate"
              >
                {s.title}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={onClose}
          className="w-full text-center text-xs py-1"
          style={{ color: 'var(--muted)' }}
        >
          取消
        </button>
      </div>
    </div>
  );
}
