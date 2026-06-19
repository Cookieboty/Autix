import {
  appendConversationMessage,
  getConversationImages as fetchConversationImages,
  updateConversationKind,
} from '@autix/sdk';
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
};
