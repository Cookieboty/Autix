'use client';

import type { RefObject } from 'react';
import {
  conversationActions,
  type AgentKind,
  type ChatAttachment,
  type StreamMessage,
  type UIAction,
} from '@autix/shared-store';
import { getChatImageUrls, type LocalChatAttachment } from '../chat-attachments';
import type { SourceImageRef } from '../chat-source-images';
import { uploadChatAttachments } from '../chat-upload-actions';
import type { useVideoInputController } from '../../video/useVideoInputController';

interface UseChatViewSendingParams {
  abortRef: RefObject<AbortController | null>;
  activeKind: AgentKind;
  activeSessionId: string | null;
  addAIUIMessage: (message: any) => void;
  addMessage: (
    sessionId: string,
    message: {
      role: 'user' | 'assistant';
      content: string;
      timestamp: string;
      metadata?: Record<string, unknown>;
    },
  ) => void;
  appendToLastAssistantMessage: (sessionId: string, content: string) => void;
  attachmentUploadFailedMessage: string;
  finalizeAIUIStreaming: (metadata?: { durationMs: number }) => void;
  getAgentKindLabel: (kind: AgentKind) => string;
  handleChatStreamMessage: (
    conversationId: string,
    message: StreamMessage,
    options?: {
      includeImageMessages?: boolean;
      errorLogLabel?: string;
      clearWaitingOnError?: boolean;
    },
  ) => void;
  isStreaming: boolean;
  modeComingSoonMessage: (kindLabel: string) => string;
  requestErrorMessage: string;
  selectedModelId: string | null;
  selectedSourceImages: SourceImageRef[];
  setChatError: (error: string | null) => void;
  setIsWaitingFirstResponse: (waiting: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  videoInput: ReturnType<typeof useVideoInputController>;
}

export function useChatViewSending({
  abortRef,
  activeKind,
  activeSessionId,
  addAIUIMessage,
  addMessage,
  appendToLastAssistantMessage,
  attachmentUploadFailedMessage,
  finalizeAIUIStreaming,
  getAgentKindLabel,
  handleChatStreamMessage,
  isStreaming,
  modeComingSoonMessage,
  requestErrorMessage,
  selectedModelId,
  selectedSourceImages,
  setChatError,
  setIsWaitingFirstResponse,
  setStreaming,
  videoInput,
}: UseChatViewSendingParams) {
  const handleSend = async (content: string, attachments?: LocalChatAttachment[]) => {
    if (!activeSessionId) return;
    setChatError(null);

    if (activeKind !== 'chat' && activeKind !== 'image' && activeKind !== 'video') {
      setChatError(modeComingSoonMessage(getAgentKindLabel(activeKind)));
      return;
    }

    if (isStreaming) {
      console.warn('[ChatView] Request already in progress, ignoring duplicate request');
      return;
    }

    setStreaming(true);
    setIsWaitingFirstResponse(true);
    abortRef.current = new AbortController();

    let uploadedAttachments: ChatAttachment[] = [];
    try {
      uploadedAttachments = await uploadChatAttachments(attachments);
    } catch (err: any) {
      setChatError(err.message ?? attachmentUploadFailedMessage);
      setStreaming(false);
      setIsWaitingFirstResponse(false);
      return;
    }
    const uploadedImages = getChatImageUrls(uploadedAttachments);
    const userMetadata =
      uploadedImages.length > 0 || uploadedAttachments.length > 0
        ? {
          ...(uploadedImages.length > 0 ? { images: uploadedImages } : {}),
          ...(uploadedAttachments.length > 0 ? { attachments: uploadedAttachments } : {}),
        }
        : undefined;

    addMessage(activeSessionId, {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      metadata: userMetadata,
    });

    addAIUIMessage({
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      payload: userMetadata,
      timestamp: new Date(),
    } as any);

    addMessage(activeSessionId, {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    });

    try {
      await conversationActions.streamConversationChat(activeSessionId, {
        body: {
          message: content,
          modelId: activeKind === 'video' ? (videoInput.model || selectedModelId || undefined) : (selectedModelId ?? undefined),
          ...(uploadedImages.length ? { images: uploadedImages } : {}),
          ...(uploadedAttachments.length ? { attachments: uploadedAttachments } : {}),
          sourceImages: selectedSourceImages.length > 0 ? selectedSourceImages : undefined,
        },
        signal: abortRef.current.signal,

        onmessage(event) {
          setIsWaitingFirstResponse(false);

          try {
            handleChatStreamMessage(activeSessionId, JSON.parse(event.data) as StreamMessage, {
              includeImageMessages: true,
            });
          } catch (parseError) {
            console.error('Failed to parse SSE message:', parseError);
          }
        },

        onerror(err) {
          console.error('SSE connection error:', err);
          setStreaming(false);
          finalizeAIUIStreaming();
          throw err;
        },

        onclose() {
          console.log('SSE connection closed');
        },

        openWhenHidden: false,

        async onopen(response) {
          if (response.ok) {
            return;
          }
          throw new Error(`HTTP ${response.status}`);
        },
      });
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        appendToLastAssistantMessage(activeSessionId, `\n\n*[${requestErrorMessage}]*`);
      }
      setStreaming(false);
      finalizeAIUIStreaming();
    }
  };

  const handleUIAction = async (componentId: string, action: string, data: Record<string, unknown>) => {
    if (!activeSessionId) return;

    const uiAction: UIAction = {
      componentId,
      action: action as 'submit' | 'cancel' | 'custom',
      data,
      timestamp: new Date().toISOString(),
    };

    setStreaming(true);
    setIsWaitingFirstResponse(true);
    abortRef.current = new AbortController();

    try {
      await conversationActions.streamConversationChat(activeSessionId, {
        body: {
          message: uiAction,
          modelId: selectedModelId ?? undefined,
        },
        signal: abortRef.current.signal,

        onmessage(event) {
          setIsWaitingFirstResponse(false);

          try {
            handleChatStreamMessage(activeSessionId, JSON.parse(event.data) as StreamMessage, {
              errorLogLabel: 'Server returned an error (UIAction)',
              clearWaitingOnError: true,
            });
          } catch (parseError) {
            console.error('Failed to parse SSE message:', parseError);
          }
        },

        onerror(err) {
          console.error('SSE connection error:', err);
          setStreaming(false);
          setIsWaitingFirstResponse(false);
          finalizeAIUIStreaming();
          throw err;
        },

        onclose() {
          console.log('SSE connection closed');
        },

        openWhenHidden: false,

        async onopen(response) {
          if (response.ok) {
            return;
          }
          throw new Error(`HTTP ${response.status}`);
        },
      });
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        appendToLastAssistantMessage(activeSessionId, `\n\n*[${requestErrorMessage}]*`);
      }
      setStreaming(false);
      setIsWaitingFirstResponse(false);
      finalizeAIUIStreaming();
    }
  };

  return {
    handleSend,
    handleUIAction,
  };
}
