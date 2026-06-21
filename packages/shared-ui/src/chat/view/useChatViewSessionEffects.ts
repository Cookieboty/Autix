'use client';

import { useEffect } from 'react';
import { useChatStore, type ChatSession } from '@autix/shared-store';
import { mapSessionMessagesToAIUIMessages } from '../chat-history-mapper';

interface UseChatViewSessionEffectsParams {
  activeSession: ChatSession | null;
  activeSessionId: string | null;
  availableModelCount: number;
  clearArtifact: () => void;
  createSession: (title?: string) => Promise<string>;
  fetchAvailableModels: () => Promise<void>;
  fetchSessions: () => Promise<void>;
  isStreaming: boolean;
  loadArtifactByConversation: (conversationId: string) => Promise<unknown>;
  newConversationTitle: string;
  openResourcePanel: (params: {
    conversationId?: string;
    type?: any;
    resourceId?: string;
    source: 'chat';
  }) => void;
  router: {
    replace: (href: string) => void;
  };
  searchParams: {
    get: (name: string) => string | null;
  };
  sessionId?: string;
  setActiveSession: (id: string) => Promise<void>;
  setAIUIMessages: (messages: any[]) => void;
  setResourcePanelConversationId: (conversationId?: string) => void;
}

export function useChatViewSessionEffects({
  activeSession,
  activeSessionId,
  availableModelCount,
  clearArtifact,
  createSession,
  fetchAvailableModels,
  fetchSessions,
  isStreaming,
  loadArtifactByConversation,
  newConversationTitle,
  openResourcePanel,
  router,
  searchParams,
  sessionId,
  setActiveSession,
  setAIUIMessages,
  setResourcePanelConversationId,
}: UseChatViewSessionEffectsParams) {
  useEffect(() => {
    setResourcePanelConversationId(activeSessionId ?? undefined);
  }, [activeSessionId, setResourcePanelConversationId]);

  useEffect(() => {
    if (searchParams.get('resourcePanel') !== '1') return;
    openResourcePanel({
      conversationId: activeSessionId ?? undefined,
      type: (searchParams.get('type') as any) ?? undefined,
      resourceId: searchParams.get('resourceId') ?? undefined,
      source: 'chat',
    });
  }, [activeSessionId, openResourcePanel, searchParams]);

  useEffect(() => {
    if (!activeSessionId) {
      clearArtifact();
      return;
    }

    loadArtifactByConversation(activeSessionId)
      .catch((error) => {
        console.error('Failed to load artifact:', error);
      });
  }, [activeSessionId, loadArtifactByConversation, clearArtifact]);

  useEffect(() => {
    const init = async () => {
      let state = useChatStore.getState();

      if (sessionId) {
        let exists = state.sessions.find((session) => session.id === sessionId);
        if (!exists) {
          await fetchSessions();
          state = useChatStore.getState();
          exists = state.sessions.find((session) => session.id === sessionId);
        }
        if (exists) {
          await setActiveSession(sessionId);
          return;
        }
      }

      if (!state.activeSessionId) {
        if (state.sessions.length === 0) {
          await fetchSessions();
          state = useChatStore.getState();
        }
        if (state.sessions.length > 0) {
          const first = state.sessions[0];
          await setActiveSession(first.id);
          router.replace(`/c/${first.id}`);
        } else {
          const id = await createSession(newConversationTitle);
          router.replace(`/c/${id}`);
        }
      }
    };
    init();
  }, [sessionId]);

  useEffect(() => {
    if (availableModelCount === 0) {
      void fetchAvailableModels();
    }
  }, [availableModelCount, fetchAvailableModels]);

  useEffect(() => {
    if (isStreaming) {
      return;
    }

    if (!activeSession?.messages || activeSession.messages.length === 0) {
      setAIUIMessages([]);
      return;
    }

    setAIUIMessages(mapSessionMessagesToAIUIMessages(activeSession.messages));
  }, [activeSession?.id, activeSession?.messages.length]);
}
