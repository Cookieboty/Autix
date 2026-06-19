'use client';

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import {
  MarketplaceTopNav,
  RuntimeBadge,
  TYPE_LABEL_KEY,
} from '@autix/shared-ui/marketplace';
import { useIsElectron } from '@autix/shared-ui/hooks';
import { FallbackImage } from '@autix/shared-ui/template';
import { Button } from '@autix/shared-ui/ui';
import { Heart, Eye, ChevronRight, Monitor } from 'lucide-react';
import {
  imageTemplateApi,
  videoTemplateApi,
  skillApi,
  mcpApi,
  agentApi,
  acquisitionsApi,
  conversationResourcesApi,
  type ImageTemplate,
  type VideoTemplate,
  type Skill,
  type McpServer,
  type AgentResource,
  type MarketplaceTypeSlug,
  type ResourceType,
} from '@autix/sdk';
import { useChatStore } from '@autix/shared-store';

const VALID_SLUGS: MarketplaceTypeSlug[] = [
  'image-templates',
  'video-templates',
  'skills',
  'mcp',
  'agents',
];

const SLUG_TO_TYPE: Record<MarketplaceTypeSlug, ResourceType> = {
  'image-templates': 'IMAGE_TEMPLATE',
  'video-templates': 'VIDEO_TEMPLATE',
  skills: 'SKILL',
  mcp: 'MCP',
  agents: 'AGENT',
};

const ACQUIRABLE: MarketplaceTypeSlug[] = ['skills', 'mcp', 'agents'];

const APIS = {
  'image-templates': imageTemplateApi,
  'video-templates': videoTemplateApi,
  skills: skillApi,
  mcp: mcpApi,
  agents: agentApi,
} as const;

type AnyResourceItem = ImageTemplate | VideoTemplate | Skill | McpServer | AgentResource;

export function MarketplaceDetailPage() {
  const navigate = useNavigate();
  const t = useTranslations('marketplace');
  const { type, id } = useParams<{ type: string; id: string }>();
  const slug = (type ?? '') as MarketplaceTypeSlug;
  const resourceId = id ?? '';
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
      .getById(resourceId)
      .then((res) => {
        if (cancelled) return;
        setResource(res.data as AnyResourceItem);
      })
      .catch((e) => setError(String((e as Error).message ?? e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [slug, resourceId, isValid]);

  if (!isValid) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <MarketplaceTopNav currentSlug={slug} />
        <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--muted)' }}>
          {t('common.unknownResourceType', { slug })}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <MarketplaceTopNav currentSlug={slug} />
        <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--muted)' }}>
          {t('common.loading')}
        </div>
      </div>
    );
  }

  if (!resource) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <MarketplaceTopNav currentSlug={slug} />
        <div className="flex-1 flex items-center justify-center text-sm text-red-500">
          {error ?? t('common.resourceNotFound')}
        </div>
      </div>
    );
  }

  const type_ = SLUG_TO_TYPE[slug];
  const isFree = resource.pointsCost === 0;
  const desktopOnly = resource.runtimeRequirement === 'DESKTOP_ONLY';
  const desktopBlocked = desktopOnly && !isElectron;
  const isAcquirable = ACQUIRABLE.includes(slug);

  let primaryLabel = t('detail.primary.acquireAndActivateCurrentSession');
  if (slug === 'image-templates' || slug === 'video-templates') {
    primaryLabel = t('detail.primary.generateAndReturnToSession');
  } else if (!acquired && !isFree) {
    primaryLabel = t('detail.primary.acquireWithPoints', { points: resource.pointsCost });
  }

  if (desktopBlocked) primaryLabel = t('detail.primary.getOnDesktop');

  async function handlePrimary() {
    if (desktopBlocked || !resource) return;
    if (slug === 'image-templates') {
      navigate(`/marketplace/image-templates/${resourceId}/workspace${activeSessionId ? `?conversationId=${activeSessionId}` : ''}`);
      return;
    }
    if (slug === 'video-templates') {
      navigate(`/marketplace/video-templates/${resourceId}/workspace${activeSessionId ? `?conversationId=${activeSessionId}` : ''}`);
      return;
    }

    setAcquiring(true);
    setError(null);
    try {
      if (!acquired) {
        await acquisitionsApi.acquire(slug as 'skills' | 'mcp' | 'agents', resourceId);
        setAcquired(true);
        const amux = (window as unknown as {
          amux?: { resources?: { install: (p: unknown) => Promise<unknown> } };
        }).amux;
        if (amux?.resources?.install) {
          try {
            await amux.resources.install({ type: type_, id: resourceId, payload: resource });
          } catch (e) {
            console.warn('[acquire] Local installation failed:', e);
          }
        }
      }
      if (slug === 'mcp' && !isElectron) {
        setError(t('detail.mcpDesktopRequired'));
        return;
      }
      const convId = activeSessionId ?? (await createSession(t('detail.newSessionTitle')));
      await conversationResourcesApi.attach(convId, type_, resourceId);
      window.dispatchEvent(new CustomEvent('conversation-resources:changed'));
      navigate(`/chat/${convId}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAcquiring(false);
    }
  }

  async function activateTo(conversationId: string | 'new') {
    let convId = conversationId;
    if (convId === 'new') convId = await createSession(t('detail.newSessionTitle'));
    if (!acquired && isAcquirable) {
      await acquisitionsApi.acquire(slug as 'skills' | 'mcp' | 'agents', resourceId);
      setAcquired(true);
    }
    await conversationResourcesApi.attach(convId, type_, resourceId);
    window.dispatchEvent(new CustomEvent('conversation-resources:changed'));
    navigate(`/chat/${convId}`);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <MarketplaceTopNav currentSlug={slug} />
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <nav className="flex items-center gap-2 text-sm mb-4" style={{ color: 'var(--muted)' }}>
          <button onClick={() => navigate(`/marketplace/${slug}`)}>
            {t(`resourceType.${TYPE_LABEL_KEY[slug]}`)}
          </button>
          <ChevronRight className="w-3 h-3" />
          <span style={{ color: 'var(--foreground)' }}>{resource.title}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div
            className="col-span-1 lg:col-span-7 rounded-lg overflow-hidden"
            style={{ backgroundColor: 'var(--panel)', border: '1px solid var(--border)' }}
          >
            <div className="aspect-[4/3]" style={{ backgroundColor: 'var(--panel-muted)' }}>
              <FallbackImage
                src={resource.coverImage}
                alt={resource.title}
                className="w-full h-full object-cover"
                fallbackText={t('common.noCover')}
              />
            </div>
          </div>

          <aside
            className="col-span-1 lg:col-span-5 rounded-lg p-5 flex flex-col"
            style={{ backgroundColor: 'var(--panel)', border: '1px solid var(--border)' }}
          >
            <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>
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
                {isFree ? t('common.free') : t('common.pointsCost', { points: resource.pointsCost })}
              </span>
              <RuntimeBadge
                level={resource.runtimeRequirement}
                reason={resource.runtimeReason ?? null}
              />
            </div>

            {resource.description && (
              <p className="text-sm mb-4 leading-relaxed" style={{ color: 'var(--muted)' }}>
                {resource.description}
              </p>
            )}

            <Button
              
              disabled={desktopBlocked || acquiring}
              onClick={handlePrimary}
              className="w-full"
            >
              {acquiring ? t('common.processing') : primaryLabel}
            </Button>

            {isAcquirable && !desktopBlocked && (
              <Button
                variant="outline"
                onClick={() => setShowActivate(true)}
                className="w-full mt-2"
              >
                {t('detail.selectSession')}
              </Button>
            )}

            {desktopBlocked && (
              <div
                className="mt-3 p-3 rounded text-xs space-y-1"
                style={{ backgroundColor: 'var(--panel-muted)' }}
              >
                <div className="flex items-center gap-1 font-medium">
                  <Monitor className="w-3 h-3" /> {t('detail.whyDesktopOnly')}
                </div>
                <p style={{ color: 'var(--muted)' }}>
                  {resource.runtimeReason ?? t('detail.localRuntimeRequired')}
                </p>
              </div>
            )}

            {error && <div className="mt-3 text-xs text-red-500">{error}</div>}

            <div
              className="flex items-center gap-3 mt-auto pt-4 border-t"
              style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
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

function ActivateDialog({
  sessions,
  onSelect,
  onClose,
}: {
  sessions: { id: string; title: string }[];
  onSelect: (id: string | 'new') => void | Promise<void>;
  onClose: () => void;
}) {
  const t = useTranslations('marketplace');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-[420px] rounded-lg p-6 space-y-4"
        style={{ backgroundColor: 'var(--panel)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold">{t('detail.activateTo')}</h3>
        <button
          onClick={() => onSelect('new')}
          className="w-full text-left px-3 py-2 rounded text-sm transition-colors hover:bg-[var(--panel-muted)]"
          style={{ border: '1px solid var(--border)' }}
        >
          {t('detail.createAndActivate')}
        </button>
        {sessions.length > 0 && (
          <div className="space-y-1">
            <div
              className="text-[11px] uppercase font-medium"
              style={{ color: 'var(--muted)' }}
            >
              {t('detail.recentSessions')}
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
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}
