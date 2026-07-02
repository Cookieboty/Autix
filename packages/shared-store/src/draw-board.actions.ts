import {
  appendConversationMessage,
  canvasBoardApi,
  createConversation,
  getAvailableModels,
  getConversationMessages,
  getConversations,
  pointsApi,
  updateConversationTitle,
  type CanvasBoardStateResponse,
  type CanvasChatGenerateResponse,
  type CanvasSaveStateResponse,
  type Conversation,
  type ConversationMessage,
  type ModelConfigItem,
} from '@autix/sdk';
import type { CanvasBoardState } from '@autix/domain';

export type {
  CanvasBoardStateResponse,
  CanvasChatGenerateResponse,
  Conversation,
  ConversationMessage,
  ModelConfigItem,
} from '@autix/sdk';

const DRAW_BOARD_DESCRIPTION_PREFIX = 'draw:conversation:';
let firstDrawConversationInFlight: Promise<Conversation> | null = null;

function isImageModel(model: ModelConfigItem): boolean {
  return Boolean(model.metadata?.imageModelKind) || model.type === 'image';
}

async function createFirstDrawConversation(): Promise<Conversation> {
  if (!firstDrawConversationInFlight) {
    firstDrawConversationInFlight = createConversation({ title: '新绘制对话', kind: 'image' })
      .then((res) => res.data)
      .finally(() => {
        firstDrawConversationInFlight = null;
      });
  }
  return firstDrawConversationInFlight;
}

// Thin async actions so shared-ui never touches the SDK directly
// (shared-ui -> shared-store -> sdk).
export const drawBoardActions = {
  ensureBoard: async (title: string): Promise<string> => {
    const list = await canvasBoardApi.list();
    const existing = list.data.items[0];
    if (existing) return existing.id;
    const created = await canvasBoardApi.create({ title });
    return created.data.board.id;
  },

  listConversations: async (): Promise<Conversation[]> => {
    const res = await getConversations();
    return res.data;
  },

  createConversation: async (title?: string): Promise<Conversation> => {
    const res = await createConversation({ title: title || '新绘制对话', kind: 'image' });
    return res.data;
  },

  ensureConversation: async (conversationId?: string | null): Promise<Conversation> => {
    const conversations = await drawBoardActions.listConversations();
    if (conversationId) {
      const requested = conversations.find((item) => item.id === conversationId);
      if (requested) return requested;
    }
    const latest = conversations[0];
    if (latest) return latest;
    return createFirstDrawConversation();
  },

  ensureBoardForConversation: async (conversation: Pick<Conversation, 'id' | 'title'>): Promise<string> => {
    const marker = `${DRAW_BOARD_DESCRIPTION_PREFIX}${conversation.id}`;
    const list = await canvasBoardApi.list();
    const existing = list.data.items.find((board) => board.description === marker);
    if (existing) return existing.id;
    const created = await canvasBoardApi.create({
      title: conversation.title || '绘制对话',
      description: marker,
    });
    return created.data.board.id;
  },

  getConversationMessages: async (conversationId: string): Promise<ConversationMessage[]> => {
    const res = await getConversationMessages(conversationId);
    return res.data;
  },

  appendConversationMessage: async (
    conversationId: string,
    data: {
      role: 'USER' | 'ASSISTANT';
      content: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<ConversationMessage> => {
    const res = await appendConversationMessage(conversationId, data);
    return res.data;
  },

  updateConversationTitle: async (conversationId: string, title: string): Promise<void> => {
    await updateConversationTitle(conversationId, title);
  },

  getState: async (boardId: string): Promise<CanvasBoardStateResponse> => {
    const res = await canvasBoardApi.getState(boardId);
    return res.data;
  },

  saveState: async (
    boardId: string,
    state: CanvasBoardState,
    revision: number,
  ): Promise<CanvasSaveStateResponse> => {
    const res = await canvasBoardApi.saveStateWithVersion(boardId, { state }, revision);
    return res.data;
  },

  updateBoard: async (
    boardId: string,
    data: { title?: string; description?: string },
  ): Promise<CanvasBoardStateResponse['board']> => {
    const res = await canvasBoardApi.update(boardId, data);
    return res.data.board;
  },

  chatGenerate: async (
    boardId: string,
    body: { idempotencyKey: string; prompt: string; modelConfigId: string; referenceImageUrls?: string[]; count?: number },
  ): Promise<CanvasChatGenerateResponse> => {
    const res = await canvasBoardApi.chatGenerate(boardId, body);
    return res.data;
  },

  /** Pick an available image model config id (default first). */
  listImageModels: async (): Promise<ModelConfigItem[]> => {
    const res = await getAvailableModels();
    const models = res.data ?? [];
    return models.filter(isImageModel);
  },

  resolveImageModelConfigId: async (): Promise<string | null> => {
    const imageModels = await drawBoardActions.listImageModels();
    const chosen = imageModels.find((m) => m.isDefault) ?? imageModels[0];
    return chosen?.id ?? null;
  },

  /** Spendable points balance for the credits indicator. */
  getCredits: async (): Promise<number> => {
    const res = await pointsApi.getBalance();
    return res.data.availableBalance ?? res.data.balance ?? 0;
  },
};
