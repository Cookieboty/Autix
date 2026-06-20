import {
  appendConversationMessage,
  authFetch,
  authFetchEventSource,
  getConversationImages as fetchConversationImages,
  getApiUrl,
  updateConversationKind,
  type FetchEventSourceInit,
} from '@autix/sdk';
import type { StreamMessage } from '@autix/domain';
import type {
  ConversationImageItem,
  ConversationImagesResponse,
  ConversationKind,
} from '@autix/domain/conversation';

export interface AppendConversationMessageInput {
  role: 'USER' | 'ASSISTANT';
  content: string;
  metadata?: Record<string, unknown>;
}

export type {
  ConversationImageItem,
  ConversationImagesResponse,
} from '@autix/domain/conversation';

export const conversationActions = {
  appendConversationMessage: (
    conversationId: string,
    data: AppendConversationMessageInput,
  ) => appendConversationMessage(conversationId, data),
  updateConversationKind: (
    conversationId: string,
    kind: ConversationKind,
  ) => updateConversationKind(conversationId, kind),
  getConversationImages: async (
    conversationId: string,
    limit?: number,
  ): Promise<ConversationImagesResponse> => {
    const res = await fetchConversationImages(conversationId, limit);
    return res.data as ConversationImagesResponse;
  },
  streamConversationChat: (
    conversationId: string,
    init: Omit<FetchEventSourceInit, 'method' | 'headers' | 'body'> & {
      body: Record<string, unknown>;
    },
  ) =>
    authFetchEventSource(
      getApiUrl(`/api/conversations/${conversationId}/chat`),
      {
        ...init,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(init.body),
      },
    ),
  streamConversationImageGeneration: async (
    conversationId: string,
    params: {
      body: Record<string, unknown>;
      signal?: AbortSignal;
      requestErrorMessage?: string;
      onMessage: (message: StreamMessage) => void;
    },
  ) => {
    const response = await authFetch(
      getApiUrl(`/api/conversations/${conversationId}/generate-image`),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params.body),
        signal: params.signal,
      },
    );

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!response.body) throw new Error(params.requestErrorMessage ?? 'Request failed');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        const dataLine = part.split('\n').find((line) => line.startsWith('data: '));
        if (!dataLine) continue;
        params.onMessage(JSON.parse(dataLine.slice(6)) as StreamMessage);
      }
    }
  },
};
