import {
  canvasBoardApi,
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
};
