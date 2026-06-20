'use client';

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import {
  ACQUIRABLE_SLUGS,
  MarketplaceDetailScreen,
  MarketplaceRouteState,
  MARKETPLACE_TYPES,
  SLUG_TO_RESOURCE_TYPE,
  type ResourceDetailAction,
  type ResourceDetailActivationDialog,
} from '@autix/shared-ui/marketplace';
import { useIsElectron } from '@autix/shared-ui/hooks';
import {
  type ImageTemplate,
  type VideoTemplate,
  type Skill,
  type McpServer,
  type AgentResource,
  type MarketplaceTypeSlug,
} from '@autix/shared-store';
import { marketplaceActions, useChatStore } from '@autix/shared-store';

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

  const isValid = useMemo(() => MARKETPLACE_TYPES.includes(slug), [slug]);

  useEffect(() => {
    if (!isValid) return;
    let cancelled = false;
    setLoading(true);
    marketplaceActions
      .getResourceDetail(slug, resourceId)
      .then((data) => {
        if (cancelled) return;
        setResource(data as AnyResourceItem);
      })
      .catch((e) => setError(String((e as Error).message ?? e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [slug, resourceId, isValid]);

  if (!isValid) {
    return (
      <MarketplaceRouteState currentSlug={slug} tone="desktop-muted">
        {t('common.unknownResourceType', { slug })}
      </MarketplaceRouteState>
    );
  }

  if (loading) {
    return (
      <MarketplaceRouteState currentSlug={slug} tone="desktop-muted">
        {t('common.loading')}
      </MarketplaceRouteState>
    );
  }

  if (!resource) {
    return (
      <MarketplaceRouteState currentSlug={slug} tone="desktop-error">
        {error ?? t('common.resourceNotFound')}
      </MarketplaceRouteState>
    );
  }

  const type_ = SLUG_TO_RESOURCE_TYPE[slug];
  const isFree = resource.pointsCost === 0;
  const desktopOnly = resource.runtimeRequirement === 'DESKTOP_ONLY';
  const desktopBlocked = desktopOnly && !isElectron;
  const isAcquirable = ACQUIRABLE_SLUGS.has(slug);

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
        await marketplaceActions.acquireResource(slug as 'skills' | 'mcp' | 'agents', resourceId);
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
      await marketplaceActions.attachConversationResource(convId, type_, resourceId);
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
      await marketplaceActions.acquireResource(slug as 'skills' | 'mcp' | 'agents', resourceId);
      setAcquired(true);
    }
    await marketplaceActions.attachConversationResource(convId, type_, resourceId);
    window.dispatchEvent(new CustomEvent('conversation-resources:changed'));
    navigate(`/chat/${convId}`);
  }

  const actions: ResourceDetailAction[] = [
    {
      id: 'primary',
      label: acquiring ? t('common.processing') : primaryLabel,
      disabled: desktopBlocked || acquiring,
      onClick: handlePrimary,
    },
  ];

  if (isAcquirable && !desktopBlocked) {
    actions.push({
      id: 'select-session',
      label: t('detail.selectSession'),
      variant: 'outline',
      onClick: () => setShowActivate(true),
    });
  }

  const activationDialog: ResourceDetailActivationDialog | undefined =
    isAcquirable
      ? {
          open: showActivate,
          sessions: sessions.slice(0, 5).map((s) => ({
            id: s.id,
            title: s.title,
          })),
          onSelect: activateTo,
          onClose: () => setShowActivate(false),
        }
      : undefined;

  return (
    <MarketplaceDetailScreen
      slug={slug}
      resource={resource}
      resourceType={type_}
      variant="panel"
      actions={actions}
      activationDialog={activationDialog}
      desktopBlocked={desktopBlocked}
      error={error}
      usageMetric="useCount"
      enableVideoPreview={false}
      showTemplateDetails={false}
      showResourceInfo={false}
      showSourceInfo={false}
      onBackToList={() => navigate(`/marketplace/${slug}`)}
    />
  );
}
