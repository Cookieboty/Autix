import {
  canvasBoardApi,
  getAvailableModels,
  pointsApi,
  type CanvasBoardStateResponse,
  type CanvasChatGenerateResponse,
  type CanvasSaveStateResponse,
} from '@autix/sdk';
import type { CanvasBoardState } from '@autix/domain';

export type { CanvasBoardStateResponse, CanvasChatGenerateResponse } from '@autix/sdk';

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

  chatGenerate: async (
    boardId: string,
    body: { idempotencyKey: string; prompt: string; modelConfigId: string; referenceImageUrls?: string[]; count?: number },
  ): Promise<CanvasChatGenerateResponse> => {
    const res = await canvasBoardApi.chatGenerate(boardId, body);
    return res.data;
  },

  /** Pick an available image model config id (default first). */
  resolveImageModelConfigId: async (): Promise<string | null> => {
    const res = await getAvailableModels();
    const models = res.data ?? [];
    const imageModels = models.filter((m) => Boolean(m.metadata?.imageModelKind) || m.type === 'image');
    const chosen = imageModels.find((m) => m.isDefault) ?? imageModels[0];
    return chosen?.id ?? null;
  },

  /** Spendable points balance for the credits indicator. */
  getCredits: async (): Promise<number> => {
    const res = await pointsApi.getBalance();
    return res.data.availableBalance ?? res.data.balance ?? 0;
  },
};
