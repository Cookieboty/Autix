'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  MarketplaceTopNav,
  RuntimeBadge,
  MARKETPLACE_ENABLED_SLUGS,
  getVideoPreviewUrl,
  useTimedVideoPreview,
} from '@autix/shared-ui/marketplace';
import { useIsElectron } from '@autix/shared-ui/hooks';
import { FallbackImage } from '@autix/shared-ui/template';
import { Button } from '@autix/shared-ui/ui';
import { Heart, Eye, ChevronRight, Monitor, ExternalLink, Star } from 'lucide-react';
import {
  conversationResourcesApi,
  type ConversationKind,
  type ResourceType,
  type ImageTemplate,
  type VideoTemplate,
  type Skill,
  type McpServer,
  type AgentResource,
  type MarketplaceTypeSlug,
} from '@autix/shared-lib';
import { useAuthStore, useResourceStore } from '@autix/shared-store';
import { useChatStore } from '@/store/chat.store';
import { SLUG_TO_TYPE } from '@/lib/resource-types';
import type { SyntheticEvent } from 'react';

const TYPE_LABEL: Record<MarketplaceTypeSlug, string> = {
  'image-templates': '图片模板',
  'video-templates': '视频模板',
  skills: 'Skill',
  mcp: 'MCP',
  agents: 'Agent',
};

type AnyResourceItem =
  | ImageTemplate
  | VideoTemplate
  | Skill
  | McpServer
  | AgentResource;

type SessionOption = {
  id: string;
  title: string;
  kind: ConversationKind;
};

function hasTemplatePrompt(
  resource: AnyResourceItem,
): resource is ImageTemplate | VideoTemplate {
  return 'prompt' in resource && typeof resource.prompt === 'string';
}

function applyErrorInfo(error: unknown): { status?: number; message: string } {
  const err = error as {
    response?: { status?: number; data?: { msg?: string; message?: string } };
    msg?: string;
    message?: string;
  };
  return {
    status: err.response?.status,
    message:
      err.msg ||
      err.response?.data?.msg ||
      err.response?.data?.message ||
      err.message ||
      '应用模板失败',
  };
}

function conversationKindLabel(kind: ConversationKind) {
  switch (kind) {
    case 'video':
      return '视频会话';
    case 'image':
      return '图片会话';
    case 'avatar':
      return '数字人会话';
    case 'chat':
    default:
      return '对话会话';
  }
}

function newTemplateSessionInput(type: ResourceType): {
  title: string;
  kind: ConversationKind;
} {
  if (type === 'IMAGE_TEMPLATE') {
    return { title: '新图片会话', kind: 'image' };
  }
  return { title: '新会话', kind: 'chat' };
}

function templateCompatibleTargetLabel(type: ResourceType) {
  if (type === 'IMAGE_TEMPLATE') return '对话会话或图片会话';
  if (type === 'VIDEO_TEMPLATE') return '对话会话';
  return '对话会话';
}

function isTemplateSessionCompatible(type: ResourceType, kind: ConversationKind) {
  if (type === 'IMAGE_TEMPLATE') return kind === 'chat' || kind === 'image';
  if (type === 'VIDEO_TEMPLATE') return kind === 'chat';
  return true;
}

function templateSessionMismatchMessage(type: ResourceType, kind: ConversationKind) {
  const target = templateCompatibleTargetLabel(type);
  return `当前选择的是${conversationKindLabel(kind)}，这个模板需要应用到${target}。请重新选择，或新建会话后应用模板。`;
}

export default function ResourceDetailPage() {
  const router = useRouter();
  const params = useParams<{ type: string; id: string }>();
  const slug = (params?.type ?? '') as MarketplaceTypeSlug;
  const id = params?.id ?? '';
  const isElectron = useIsElectron();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { sessions, createSession } = useChatStore();
  const {
    currentResource,
    detailLoading,
    error: fetchError,
    fetchDetail,
    toggleFavorite,
  } = useResourceStore();

  const [error, setError] = useState<string | null>(null);
  const [showActivate, setShowActivate] = useState(false);
  const [applying, setApplying] = useState(false);
  const [favoriteSubmitting, setFavoriteSubmitting] = useState(false);

  const isValid = useMemo(() => MARKETPLACE_ENABLED_SLUGS.includes(slug), [slug]);

  useEffect(() => {
    if (!isValid) return;
    fetchDetail(slug, id);
  }, [slug, id, isValid, fetchDetail]);

  // 只认当前路由对应的资源,避免 store 残留上一个详情造成串台
  const resource =
    currentResource && currentResource.id === id
      ? (currentResource as AnyResourceItem)
      : null;

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

  if (detailLoading || (!resource && !fetchError)) {
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
          {fetchError ?? '资源不存在'}
        </div>
      </div>
    );
  }

  const type = SLUG_TO_TYPE[slug];
  const isFree = resource.pointsCost === 0;
  const desktopOnly = resource.runtimeRequirement === 'DESKTOP_ONLY';
  const desktopBlocked = desktopOnly && !isElectron;
  const isTemplateResource = type === 'IMAGE_TEMPLATE' || type === 'VIDEO_TEMPLATE';

  async function attachTemplateToConversation(conversationId: string) {
    try {
      await conversationResourcesApi.attach(conversationId, type, id);
      return;
    } catch (e) {
      const { status, message } = applyErrorInfo(e);
      if (status === 409 && message.includes('已激活')) return;
      if (
        status === 409 &&
        isTemplateResource &&
        message.includes(type === 'IMAGE_TEMPLATE' ? '图片模板' : '视频模板')
      ) {
        const links = await conversationResourcesApi.list(conversationId);
        const existing = links.data.find((link) => link.resourceType === type);
        if (existing) {
          await conversationResourcesApi.detach(conversationId, type, existing.resourceId);
          await conversationResourcesApi.attach(conversationId, type, id);
          return;
        }
      }
      throw e;
    }
  }

  async function activateTo(conversationId: string | 'new') {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    if (desktopBlocked) return;

    setApplying(true);
    setError(null);
    let convId: string | null = null;
    try {
      if (conversationId === 'new') {
        const input = newTemplateSessionInput(type);
        convId = await createSession(input.title, { kind: input.kind });
      } else {
        convId = conversationId;
      }
      await attachTemplateToConversation(convId);
      window.dispatchEvent(new CustomEvent('conversation-resources:changed'));
      router.push(`/c/${convId}`);
    } catch (e) {
      const { message } = applyErrorInfo(e);
      setError(message);
    } finally {
      setApplying(false);
    }
  }

  async function handleToggleFavorite() {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    if (!isTemplateResource || favoriteSubmitting) return;

    setFavoriteSubmitting(true);
    setError(null);
    try {
      await toggleFavorite(slug, id);
    } catch (e) {
      const { message } = applyErrorInfo(e);
      setError(message);
    } finally {
      setFavoriteSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <MarketplaceTopNav currentSlug={slug} />

      <div className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,#020617_0%,#08111f_36%,var(--background)_100%)] px-4 py-5 text-white sm:px-6">
        <nav className="mb-4 flex items-center gap-2 text-sm text-white/52">
          <button
            onClick={() => router.push(`/marketplace/${slug}`)}
            className="transition-colors hover:text-white"
          >
            {TYPE_LABEL[slug]}
          </button>
          <ChevronRight className="h-3 w-3" />
          <span className="truncate text-white">{resource.title}</span>
        </nav>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="col-span-1 overflow-hidden rounded-lg border border-white/12 bg-white/[0.075] shadow-2xl backdrop-blur-xl lg:col-span-7">
            <DetailMedia resource={resource} isVideoTemplate={slug === 'video-templates'} />
          </div>

          <aside className="col-span-1 flex flex-col rounded-lg border border-white/12 bg-white/[0.075] p-5 shadow-2xl backdrop-blur-xl lg:col-span-5">
            <h1 className="mb-1 text-xl font-bold text-white">
              {resource.title}
            </h1>
            <p className="mb-3 text-xs text-white/46">
              by {resource.authorId}
            </p>

            <div className="mb-4 flex items-center gap-2">
              <span
                className={
                  'rounded-full px-3 py-1 text-sm font-medium ' +
                  (isFree
                    ? 'bg-green-500 text-white'
                    : 'bg-white/10 text-white')
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
              <p className="mb-4 text-sm leading-relaxed text-white/62">
                {resource.description}
              </p>
            )}

            <Button
              disabled={desktopBlocked}
              onClick={() => {
                if (!isAuthenticated) {
                  router.push('/login');
                  return;
                }
                setError(null);
                setShowActivate(true);
              }}
              className="w-full"
            >
              选择会话并应用模板
            </Button>

            {isTemplateResource && (
              <Button
                type="button"
                variant="outline"
                disabled={favoriteSubmitting}
                onClick={handleToggleFavorite}
                className="mt-2 w-full border-white/16 bg-white/10 text-white hover:bg-white/16 hover:text-white"
              >
                <Star className="h-4 w-4" />
                收藏 {resource.favoriteCount}
              </Button>
            )}

            {desktopBlocked && (
              <div className="mt-3 space-y-1 rounded-lg border border-white/10 bg-white/10 p-3 text-xs">
                <div className="flex items-center gap-1 font-medium text-white">
                  <Monitor className="h-3 w-3" />
                  为什么仅桌面端?
                </div>
                <p className="text-white/58">
                  {resource.runtimeReason ?? '该资源需要本地运行环境'}
                </p>
              </div>
            )}

            {error && (
              <div className="mt-3 text-xs text-destructive">{error}</div>
            )}

            <div className="mt-auto flex items-center gap-3 border-t border-white/10 pt-4 text-white/54">
              <span className="flex items-center gap-1 text-xs">
                <Eye className="h-3 w-3" />
                {resource.viewCount}
              </span>
              <span className="flex items-center gap-1 text-xs">
                <Heart className="h-3 w-3" />
                {resource.likeCount}
              </span>
            </div>
          </aside>
        </div>

        {hasTemplatePrompt(resource) && (
          <div className="mt-6 rounded-lg border border-white/12 bg-white/[0.075] p-5 shadow-xl backdrop-blur-xl">
            <h2 className="mb-3 text-sm font-semibold text-white">
              Prompt
            </h2>
            <pre className="max-h-[420px] overflow-y-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/28 p-4 text-xs leading-5 text-white/78">
              {resource.prompt}
            </pre>
            {resource.variables.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 text-xs font-semibold text-white">
                  变量定义
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {resource.variables.map((variable) => (
                    <div
                      key={variable.key}
                      className="rounded-lg border border-white/10 bg-white/[0.055] px-3 py-2 text-xs"
                    >
                      <div className="font-medium text-white">
                        {variable.label}
                        <span className="ml-1 font-mono text-[10px] text-white/46">
                          {`{{${variable.key}}}`}
                        </span>
                      </div>
                      <div className="mt-1 text-white/52">
                        {variable.type}
                        {variable.default ? ` · 默认: ${variable.default}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-6">
          <div className="rounded-lg border border-white/12 bg-white/[0.075] p-5 shadow-xl backdrop-blur-xl">
            <h2 className="mb-3 text-sm font-semibold text-white">
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

        {(resource.originalUrl ||
          resource.authorName ||
          resource.sourcePlatform ||
          resource.externalId) && (
          <div className="mt-6">
            <div className="rounded-lg border border-white/12 bg-white/[0.075] p-5 shadow-xl backdrop-blur-xl">
              <h2 className="mb-3 text-sm font-semibold text-white">
                来源信息
              </h2>
              <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                {resource.authorName && (
                  <div>
                    <div className="text-white/48">作者</div>
                    {resource.authorUrl ? (
                      <a
                        href={resource.authorUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-blue-500 hover:underline"
                      >
                        {resource.authorName}
                      </a>
                    ) : (
                      <div className="break-all text-white">
                        {resource.authorName}
                      </div>
                    )}
                  </div>
                )}
                {resource.sourcePlatform && (
                  <Info label="平台" value={resource.sourcePlatform} />
                )}
                {resource.externalId && (
                  <Info label="外部 ID" value={resource.externalId} />
                )}
                {resource.originalUrl && (
                  <div>
                    <div className="text-white/48">原始链接</div>
                    <a
                      href={resource.originalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-500 hover:underline"
                    >
                      查看原文
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showActivate && (
          <ActivateDialog
            sessions={sessions.slice(0, 8).map((s) => ({
              id: s.id,
              title: s.title,
              kind: s.kind,
            }))}
            onSelect={activateTo}
            onClose={() => setShowActivate(false)}
            applying={applying}
            error={error}
            resourceType={type}
            onError={setError}
          />
        )}
      </div>
    </div>
  );
}

function DetailMedia({
  resource,
  isVideoTemplate,
}: {
  resource: AnyResourceItem;
  isVideoTemplate: boolean;
}) {
  const previewUrl = useMemo(
    () => (isVideoTemplate ? getVideoPreviewUrl(resource) : null),
    [isVideoTemplate, resource],
  );
  const { previewRef, startPreview, stopPreview } =
    useTimedVideoPreview(previewUrl);

  return (
    <div
      className="group relative aspect-[4/3] overflow-hidden bg-black/30"
      onPointerEnter={startPreview}
      onPointerLeave={stopPreview}
      onFocus={startPreview}
      onBlur={stopPreview}
      tabIndex={previewUrl ? 0 : undefined}
    >
      <FallbackImage
        src={resource.coverImage}
        alt={resource.title}
        className={`h-full w-full object-cover transition-all duration-500 group-hover:scale-[1.025] ${
          previewUrl ? 'group-hover:opacity-0' : ''
        }`}
        fallbackText="暂无封面"
      />
      {previewUrl && (
        <video
          ref={previewRef}
          className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          src={previewUrl}
          muted
          playsInline
          preload="metadata"
          poster={resource.coverImage ?? undefined}
          onEnded={stopPreview}
          onError={stopPreview}
          onLoadedData={(event: SyntheticEvent<HTMLVideoElement>) => {
            event.currentTarget.currentTime = 0;
          }}
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/18 via-transparent to-black/64" />
      {isVideoTemplate && (
        <div
          className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-all duration-300 group-hover:scale-105 ${
            previewUrl ? 'group-hover:opacity-0' : ''
          }`}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/28 bg-white/20 text-white shadow-2xl backdrop-blur-md">
            <span className="ml-1 h-0 w-0 border-y-[10px] border-l-[16px] border-y-transparent border-l-white" />
          </span>
        </div>
      )}
      {previewUrl && (
        <div className="pointer-events-none absolute bottom-4 left-4 rounded-full border border-white/14 bg-black/40 px-3 py-1 text-xs text-white/72 backdrop-blur-md">
          悬停预览前几秒
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-white/48">{label}</div>
      <div className="text-white">{value}</div>
    </div>
  );
}

function ActivateDialog({
  sessions,
  onSelect,
  onClose,
  applying,
  error,
  resourceType,
  onError,
}: {
  sessions: SessionOption[];
  onSelect: (id: string | 'new') => void | Promise<void>;
  onClose: () => void;
  applying: boolean;
  error: string | null;
  resourceType: ResourceType;
  onError: (message: string | null) => void;
}) {
  const targetLabel = templateCompatibleTargetLabel(resourceType);

  const handleSelectSession = (session: SessionOption) => {
    if (!isTemplateSessionCompatible(resourceType, session.kind)) {
      onError(templateSessionMismatchMessage(resourceType, session.kind));
      return;
    }
    onError(null);
    void onSelect(session.id);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={() => {
        if (!applying) onClose();
      }}
    >
      <div
        className="w-[420px] max-w-[calc(100vw-2rem)] space-y-4 rounded-lg border border-white/12 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(8,17,31,0.96))] p-6 text-white shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-white">选择会话并应用模板</h3>
          <p className="text-xs text-white/54">
            请选择{targetLabel}，或新建会话后应用。
          </p>
        </div>
        <button
          type="button"
          disabled={applying}
          onClick={() => {
            onError(null);
            void onSelect('new');
          }}
          className="w-full rounded-lg border border-white/12 bg-white/[0.055] px-3 py-2 text-left text-sm text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {applying ? '应用中…' : '+ 新建会话并应用模板'}
        </button>
        {sessions.length > 0 && (
          <div className="space-y-1">
            <div className="text-[11px] font-medium uppercase text-white/48">
              最近会话
            </div>
            {sessions.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={applying}
                onClick={() => handleSelectSession(s)}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="min-w-0 truncate">{s.title}</span>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${
                    isTemplateSessionCompatible(resourceType, s.kind)
                      ? 'border-emerald-300/30 bg-emerald-400/12 text-emerald-100'
                      : 'border-white/10 bg-white/[0.06] text-white/44'
                  }`}
                >
                  {conversationKindLabel(s.kind)}
                </span>
              </button>
            ))}
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100">
            {error}
          </div>
        )}
        <button
          type="button"
          disabled={applying}
          onClick={onClose}
          className="w-full py-1 text-center text-xs text-white/52 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          取消
        </button>
      </div>
    </div>
  );
}
