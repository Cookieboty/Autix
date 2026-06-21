'use client';

import { useCallback } from 'react';
import { marketplaceActions } from '@autix/shared-store';
import type { MarketplaceChatDockProps } from './marketplace-chat-dock-types';
import { getTemplateConversationKind } from './marketplace-chat-dock-utils';

interface UseMarketplaceTemplateSessionParams {
  activeSessionId: string | null;
  attachTemplateFailedMessage: string;
  createSession: (
    title?: string,
    options?: { kind?: ReturnType<typeof getTemplateConversationKind> },
  ) => Promise<string>;
  createSessionFailedMessage: string;
  deleteSession: (sessionId: string) => Promise<void>;
  resourceType: MarketplaceChatDockProps['resourceType'];
  sessionId: string | null;
  setActiveSession: (sessionId: string) => Promise<void>;
  setError: (error: string | null) => void;
  setSessionId: (sessionId: string | null) => void;
  template: MarketplaceChatDockProps['template'];
}

export function useMarketplaceTemplateSession({
  activeSessionId,
  attachTemplateFailedMessage,
  createSession,
  createSessionFailedMessage,
  deleteSession,
  resourceType,
  sessionId,
  setActiveSession,
  setError,
  setSessionId,
  template,
}: UseMarketplaceTemplateSessionParams) {
  return useCallback(async (): Promise<string | null> => {
    if (!template) return null;
    if (sessionId) return sessionId;

    const previousActiveSessionId = activeSessionId;
    const kind = getTemplateConversationKind(resourceType);

    let convId: string;
    try {
      convId = await createSession(template.title, { kind });
      setSessionId(convId);
    } catch (err: any) {
      setError(err.message ?? createSessionFailedMessage);
      return null;
    }

    try {
      await marketplaceActions.attachConversationResource(
        convId,
        resourceType,
        template.id,
      );
    } catch (err: any) {
      try {
        await deleteSession(convId);
        if (previousActiveSessionId) {
          await setActiveSession(previousActiveSessionId);
        }
      } catch {
        // Best-effort rollback; the attach error below is the user-facing failure.
      }
      setSessionId(null);
      setError(err.message ?? attachTemplateFailedMessage);
      return null;
    }

    return convId;
  }, [
    activeSessionId,
    attachTemplateFailedMessage,
    createSession,
    createSessionFailedMessage,
    deleteSession,
    resourceType,
    sessionId,
    setActiveSession,
    setError,
    setSessionId,
    template,
  ]);
}
