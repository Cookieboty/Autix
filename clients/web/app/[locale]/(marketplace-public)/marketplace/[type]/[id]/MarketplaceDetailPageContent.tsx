'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import {
  MARKETPLACE_ENABLED_SLUGS,
  MarketplaceDetailScreen,
  MarketplaceRouteState,
  SLUG_TO_RESOURCE_TYPE,
  type ResourceDetailAction,
  type ResourceDetailActivationDialog,
} from '@autix/shared-ui/marketplace';
import { useChatEnabled, useIsElectron } from '@autix/shared-ui/hooks';
import { Star } from 'lucide-react';
import {
  type ConversationKind,
  type ResourceType,
  type ImageTemplate,
  type VideoTemplate,
  type Skill,
  type McpServer,
  type AgentResource,
  type MarketplaceTypeSlug,
} from '@autix/shared-store';
import { marketplaceActions, useAuthStore, useResourceStore, useUiStore } from '@autix/shared-store';
import { useChatStore } from '@autix/shared-store';

type AnyResourceItem =
  | ImageTemplate
  | VideoTemplate
  | Skill
  | McpServer
  | AgentResource;

function applyErrorInfo(error: unknown, fallback: string): { status?: number; message: string } {
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
      fallback,
  };
}

function newTemplateSessionInput(
  type: ResourceType,
  labels: { imageTitle: string; chatTitle: string },
): {
  title: string;
  kind: ConversationKind;
} {
  if (type === 'IMAGE_TEMPLATE') {
    return { title: labels.imageTitle, kind: 'image' };
  }
  return { title: labels.chatTitle, kind: 'chat' };
}

export default function MarketplaceDetailPageContent() {
  const router = useRouter();
  const t = useTranslations('marketplace');
  const params = useParams<{ type: string; id: string }>();
  const slug = (params?.type ?? '') as MarketplaceTypeSlug;
  const id = params?.id ?? '';
  const isElectron = useIsElectron();
  const chatEnabled = useChatEnabled(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authHydrated = useAuthStore((s) => s.hydrated);
  const openAuthModal = useUiStore((s) => s.openAuthModal);
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
      <MarketplaceRouteState currentSlug={slug} tone="web-muted">
        {t('common.unknownResourceType', { slug })}
      </MarketplaceRouteState>
    );
  }

  if (detailLoading || (!resource && !fetchError)) {
    return (
      <MarketplaceRouteState currentSlug={slug} tone="web-muted">
        {t('common.loading')}
      </MarketplaceRouteState>
    );
  }

  if (!resource) {
    return (
      <MarketplaceRouteState currentSlug={slug} tone="web-error">
        {fetchError ?? t('common.resourceNotFound')}
      </MarketplaceRouteState>
    );
  }

  const type = SLUG_TO_RESOURCE_TYPE[slug];
  const desktopOnly = resource.runtimeRequirement === 'DESKTOP_ONLY';
  const desktopBlocked = desktopOnly && !isElectron;
  const isTemplateResource = type === 'IMAGE_TEMPLATE' || type === 'VIDEO_TEMPLATE';
  const requestLogin = () => {
    openAuthModal({ mode: 'entry' });
  };
  // hydrate 完成前登录态未知，不能把已登录用户当作匿名而弹登录框；
  // 未 hydrate 时先放行返回 false，让调用方 return，用户 hydrate 后重试即可。
  const ensureAuthed = () => {
    if (!authHydrated) return false;
    if (!isAuthenticated) {
      requestLogin();
      return false;
    }
    return true;
  };

  async function attachTemplateToConversation(conversationId: string) {
    try {
      await marketplaceActions.attachConversationResource(conversationId, type, id);
      return;
    } catch (e) {
      const { status, message } = applyErrorInfo(e, t('detail.applyTemplateFailed'));
      if (status === 409 && !isTemplateResource) return;
      if (
        status === 409 &&
        isTemplateResource
      ) {
        const links = await marketplaceActions.listConversationResources(conversationId);
        const existing = links.find((link) => link.resourceType === type);
        if (existing) {
          await marketplaceActions.detachConversationResource(conversationId, type, existing.resourceId);
          await marketplaceActions.attachConversationResource(conversationId, type, id);
          return;
        }
      }
      throw e;
    }
  }

  async function activateTo(conversationId: string | 'new') {
    if (!ensureAuthed()) return;
    if (desktopBlocked) return;

    setApplying(true);
    setError(null);
    let convId: string | null = null;
    try {
      if (conversationId === 'new') {
        const input = newTemplateSessionInput(type, {
          imageTitle: t('detail.newImageSessionTitle'),
          chatTitle: t('detail.newSessionTitle'),
        });
        convId = await createSession(input.title, { kind: input.kind });
      } else {
        convId = conversationId;
      }
      await attachTemplateToConversation(convId);
      window.dispatchEvent(new CustomEvent('conversation-resources:changed'));
      router.push(`/c/${convId}`);
    } catch (e) {
      const { message } = applyErrorInfo(e, t('detail.applyTemplateFailed'));
      setError(message);
    } finally {
      setApplying(false);
    }
  }

  async function handleToggleFavorite() {
    if (!ensureAuthed()) return;
    if (!isTemplateResource || favoriteSubmitting) return;

    setFavoriteSubmitting(true);
    setError(null);
    try {
      await toggleFavorite(slug, id);
    } catch (e) {
      const { message } = applyErrorInfo(e, t('detail.applyTemplateFailed'));
      setError(message);
    } finally {
      setFavoriteSubmitting(false);
    }
  }

  const actions: ResourceDetailAction[] = [];
  if (chatEnabled) {
    actions.push({
      id: 'chat',
      label: t('detail.useInChat'),
      disabled: desktopBlocked,
      variant: isTemplateResource ? 'outline' : 'default',
      onClick: () => {
        if (!ensureAuthed()) return;
        setError(null);
        setShowActivate(true);
      },
    });
  }
  if (isTemplateResource) {
    actions.push({
      id: 'favorite',
      label: t('detail.favoriteCount', { count: resource.favoriteCount }),
      icon: <Star className="h-4 w-4" />,
      disabled: favoriteSubmitting,
      variant: 'outline',
      onClick: handleToggleFavorite,
    });
  }

  const activationDialog: ResourceDetailActivationDialog | undefined =
    chatEnabled
      ? {
          open: showActivate,
          sessions: sessions.slice(0, 8).map((s) => ({
            id: s.id,
            title: s.title,
            kind: s.kind,
          })),
          onSelect: activateTo,
          onClose: () => setShowActivate(false),
          applying,
          error,
          resourceType: type,
          onError: setError,
          mode: 'template',
        }
      : undefined;

  return (
    <MarketplaceDetailScreen
      slug={slug}
      resource={resource}
      resourceType={type}
      variant="immersive"
      actions={actions}
      activationDialog={activationDialog}
      desktopBlocked={desktopBlocked}
      error={error}
      usageMetric="viewCount"
      onBackToList={() => router.push(`/marketplace/${slug}`)}
    />
  );
}
