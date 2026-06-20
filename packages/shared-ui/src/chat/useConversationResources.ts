'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  marketplaceActions,
  type AgentKind,
  type ConversationResourceLink,
  type ResourceType,
  type VideoTemplate,
} from '@autix/shared-store';

type ActiveAgentResource = {
  id?: string;
  title?: string;
  kind?: AgentKind;
};

type ImageTemplateResource = {
  id?: string;
  title?: string;
  prompt?: string;
  variables?: Array<{ key?: string; default?: string }>;
  coverImage?: string;
  exampleImages?: string[];
  modelHint?: string;
};

export function useConversationResources(activeSessionId?: string | null) {
  const [activeResources, setActiveResources] = useState<ConversationResourceLink[]>([]);

  const activeAgentResource = activeResources.find((item) => item.resourceType === 'AGENT');
  const activeAgent = activeAgentResource?.resource as ActiveAgentResource | undefined;
  const activeImageTemplate = activeResources.find((item) => item.resourceType === 'IMAGE_TEMPLATE');
  const activeVideoTemplate = activeResources.find((item) => item.resourceType === 'VIDEO_TEMPLATE');
  const imageTemplateResource = activeImageTemplate?.resource as ImageTemplateResource | undefined;
  const videoTemplateResource = activeVideoTemplate?.resource as VideoTemplate | undefined;

  const activeTemplates = useMemo(
    () =>
      [
        activeImageTemplate ? { type: 'IMAGE_TEMPLATE', id: activeImageTemplate.resourceId } : null,
        activeVideoTemplate ? { type: 'VIDEO_TEMPLATE', id: activeVideoTemplate.resourceId } : null,
      ].filter((item): item is { type: ResourceType; id: string } => Boolean(item?.id)),
    [activeImageTemplate, activeVideoTemplate],
  );

  const refreshResources = useCallback(async () => {
    if (!activeSessionId) {
      setActiveResources([]);
      return;
    }
    try {
      const items = await marketplaceActions.listConversationResources(activeSessionId);
      setActiveResources(items);
    } catch {
      setActiveResources([]);
    }
  }, [activeSessionId]);

  const detachActiveTemplates = useCallback(async (conversationId: string) => {
    if (activeTemplates.length === 0) return;

    setActiveResources((prev) =>
      prev.filter(
        (item) =>
          !activeTemplates.some(
            (template) =>
              item.resourceType === template.type && item.resourceId === template.id,
          ),
      ),
    );

    await Promise.all(
      activeTemplates.map((template) =>
        marketplaceActions.detachConversationResource(
          conversationId,
          template.type,
          template.id,
        ),
      ),
    );
  }, [activeTemplates]);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      if (!activeSessionId) {
        setActiveResources([]);
        return;
      }
      try {
        const items = await marketplaceActions.listConversationResources(activeSessionId);
        if (!cancelled) {
          setActiveResources(items);
        }
      } catch {
        if (!cancelled) setActiveResources([]);
      }
    };
    void refresh();
    const handler = () => void refresh();
    window.addEventListener('conversation-resources:changed', handler);
    return () => {
      cancelled = true;
      window.removeEventListener('conversation-resources:changed', handler);
    };
  }, [activeSessionId]);

  return {
    activeAgent,
    activeImageTemplate,
    activeVideoTemplate,
    imageTemplateResource,
    videoTemplateResource,
    refreshResources,
    detachActiveTemplates,
  };
}
