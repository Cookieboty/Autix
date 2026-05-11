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
      <div className="flex h-full flex-col overflow-hidden">
        <MarketplaceTopNav currentSlug={slug} />
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          未知资源类型: {slug}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <MarketplaceTopNav currentSlug={slug} />
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          加载中…
        </div>
      </div>
    );
  }

  if (!resource) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <MarketplaceTopNav currentSlug={slug} />
        <div className="flex flex-1 items-center justify-center text-sm text-destructive">
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
  if (!acquired && !isFree && isAcquirable) {
    primaryLabel = `使用 ${resource.pointsCost} 积分获取并激活`;
  }

  if (desktopBlocked) {
    primaryLabel = '在桌面端获取';
  }

  // ── 主按钮行为 ────────────────────────────────────────────────────
  async function handlePrimary() {
    if (desktopBlocked) return;

    setAcquiring(true);
    setError(null);
    try {
      if (!acquired && isAcquirable) {
        await acquisitionsApi.acquire(slug as 'skills' | 'mcp' | 'agents', id);
        setAcquired(true);
        const amux = (window as unknown as { amux?: { resources?: { install: (p: unknown) => Promise<unknown> } } }).amux;
        if (amux?.resources?.install) {
          try {
            await amux.resources.install({ type, id, payload: resource });
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
        <nav className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <button
            onClick={() => router.push(`/marketplace/${slug}`)}
            className="hover:text-foreground transition-colors"
          >
            {TYPE_LABEL[slug]}
          </button>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{resource.title}</span>
        </nav>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="col-span-1 overflow-hidden rounded-lg border border-border bg-card lg:col-span-7">
            <div className="aspect-[4/3] bg-muted">
              <FallbackImage
                src={resource.coverImage}
                alt={resource.title}
                className="h-full w-full object-cover"
                fallbackText="暂无封面"
              />
            </div>
          </div>

          <aside className="col-span-1 flex flex-col rounded-lg border border-border bg-card p-5 lg:col-span-5">
            <h1 className="mb-1 text-xl font-bold text-foreground">
              {resource.title}
            </h1>
            <p className="mb-3 text-xs text-muted-foreground">
              by {resource.authorId}
            </p>

            <div className="mb-4 flex items-center gap-2">
              <span
                className={
                  'rounded-full px-3 py-1 text-sm font-medium ' +
                  (isFree
                    ? 'bg-green-500 text-white'
                    : 'bg-muted text-foreground')
                }
              >
                {isFree ? '免费' : `${resource.pointsCost} 积分`}
              </span>
              <RuntimeBadge
                level={resource.runtimeRequirement}
                reason={resource.runtimeReason ?? null}
              />
            </div>

            {resource.description && (
              <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
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

            {!desktopBlocked && (
              <Button
                variant="outline"
                onClick={() => setShowActivate(true)}
                className="mt-2 w-full"
              >
                选择会话
              </Button>
            )}

            {desktopBlocked && (
              <div className="mt-3 space-y-1 rounded bg-muted p-3 text-xs">
                <div className="flex items-center gap-1 font-medium text-foreground">
                  <Monitor className="h-3 w-3" />
                  为什么仅桌面端?
                </div>
                <p className="text-muted-foreground">
                  {resource.runtimeReason ?? '该资源需要本地运行环境'}
                </p>
              </div>
            )}

            {error && (
              <div className="mt-3 text-xs text-destructive">{error}</div>
            )}

            <div className="mt-auto flex items-center gap-3 border-t border-border pt-4 text-muted-foreground">
              <span className="flex items-center gap-1 text-xs">
                <Eye className="h-3 w-3" />
                {resource.useCount}
              </span>
              <span className="flex items-center gap-1 text-xs">
                <Heart className="h-3 w-3" />
                {resource.likeCount}
              </span>
            </div>
          </aside>
        </div>

        <div className="mt-6">
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              资源信息
            </h2>
            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
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

        {showActivate && (
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
      <div className="text-muted-foreground">{label}</div>
      <div className="text-foreground">{value}</div>
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
        className="w-[420px] space-y-4 rounded-lg border border-border bg-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-foreground">激活到</h3>
        <button
          onClick={() => onSelect('new')}
          className="w-full rounded border border-border px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
        >
          + 新建会话并激活
        </button>
        {sessions.length > 0 && (
          <div className="space-y-1">
            <div className="text-[11px] font-medium uppercase text-muted-foreground">
              最近会话
            </div>
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => onSelect(s.id)}
                className="w-full truncate rounded px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
              >
                {s.title}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={onClose}
          className="w-full py-1 text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  );
}
