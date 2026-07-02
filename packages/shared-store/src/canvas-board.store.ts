import { create } from 'zustand';
import {
  canvasBoardApi,
  type CanvasBoardStateResponse,
  type CanvasImageGenerateInput,
} from '@autix/sdk';
import {
  type CanvasAction,
  type CanvasActionEstimate,
  type CanvasActionType,
  type CanvasBoard,
  type CanvasBoardState,
  type CanvasEntitlement,
  type CanvasNode,
  type GenerationTaskCanvasNode,
  CANVAS_FREE_TIER_ENTITLEMENT,
  createEmptyCanvasBoardState,
  normalizeCanvasBoardState,
  placeGeneratedNodesNearSource,
} from '@autix/domain';

const AUTOSAVE_DEBOUNCE_MS = 1000;
const ACTION_POLL_INTERVAL_MS = 3000;
const UNDO_LIMIT = 50;

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

interface CanvasBoardStore {
  boardId: string | null;
  board: CanvasBoard | null;
  state: CanvasBoardState;
  revision: number;
  entitlement: CanvasEntitlement;
  selectedNodeIds: string[];
  runningActions: CanvasAction[];
  estimate: CanvasActionEstimate | null;
  loading: boolean;
  saveStatus: SaveStatus;
  dirty: boolean;
  errorMessage: string | null;
  undoStack: CanvasBoardState[];
  redoStack: CanvasBoardState[];

  load: (boardId: string) => Promise<void>;
  fetchEstimate: (
    actionType: CanvasActionType,
    selectedNodeIds: string[],
    modelConfigId?: string,
    count?: number,
  ) => Promise<void>;
  applyLocalChange: (mutator: (state: CanvasBoardState) => CanvasBoardState) => void;
  setSelection: (ids: string[]) => void;
  undo: () => void;
  redo: () => void;
  saveNow: () => Promise<void>;
  generateImage: (input: {
    selectedNodeIds: string[];
    modelConfigId: string;
    count?: number;
  }) => Promise<void>;
  resumeRunningActions: () => Promise<void>;
  reset: () => void;
}

let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
let actionPollTimer: ReturnType<typeof setInterval> | null = null;

function clearTimers() {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  if (actionPollTimer) clearInterval(actionPollTimer);
  autosaveTimer = null;
  actionPollTimer = null;
}

// Non-crypto client id for optimistic placeholders (server reconciles by it).
function clientId(prefix: string, seed: number): string {
  return `${prefix}_${seed.toString(36)}_${(seed * 2654435761 % 2 ** 31).toString(36)}`;
}

export const useCanvasBoardStore = create<CanvasBoardStore>((set, get) => {
  function applyServerResponse(data: CanvasBoardStateResponse) {
    set({
      board: data.board,
      state: normalizeCanvasBoardState(data.state),
      revision: data.board.revision,
      entitlement: data.entitlement,
      runningActions: data.actions ?? [],
      dirty: false,
      saveStatus: 'saved',
      errorMessage: null,
    });
  }

  function scheduleAutosave() {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      void get().saveNow();
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  function ensureActionPolling() {
    if (actionPollTimer) return;
    actionPollTimer = setInterval(() => {
      const { boardId, runningActions } = get();
      if (!boardId || runningActions.length === 0) {
        if (actionPollTimer) clearInterval(actionPollTimer);
        actionPollTimer = null;
        return;
      }
      void get().resumeRunningActions();
    }, ACTION_POLL_INTERVAL_MS);
  }

  return {
    boardId: null,
    board: null,
    state: createEmptyCanvasBoardState(1),
    revision: 1,
    entitlement: CANVAS_FREE_TIER_ENTITLEMENT,
    selectedNodeIds: [],
    runningActions: [],
    estimate: null,
    loading: false,
    saveStatus: 'idle',
    dirty: false,
    errorMessage: null,
    undoStack: [],
    redoStack: [],

    fetchEstimate: async (actionType, selectedNodeIds, modelConfigId, count) => {
      const { boardId } = get();
      if (!boardId) return;
      try {
        const res = await canvasBoardApi.estimateAction(boardId, {
          actionType,
          selectedNodeIds,
          modelConfigId,
          count,
        });
        set({ estimate: res.data });
      } catch {
        set({ estimate: null });
      }
    },

    load: async (boardId) => {
      clearTimers();
      set({ boardId, loading: true, undoStack: [], redoStack: [], errorMessage: null });
      try {
        const res = await canvasBoardApi.getState(boardId);
        applyServerResponse(res.data);
        if (res.data.actions?.length) ensureActionPolling();
      } catch (error) {
        set({ loading: false, errorMessage: toMessage(error) });
        return;
      }
      set({ loading: false });
    },

    applyLocalChange: (mutator) => {
      const { state, undoStack } = get();
      const next = mutator(state);
      if (next === state) return;
      set({
        state: next,
        undoStack: [...undoStack, state].slice(-UNDO_LIMIT),
        redoStack: [],
        dirty: true,
      });
      scheduleAutosave();
    },

    setSelection: (ids) => set({ selectedNodeIds: ids }),

    undo: () => {
      const { undoStack, redoStack, state } = get();
      if (undoStack.length === 0) return;
      const previous = undoStack[undoStack.length - 1];
      set({
        state: previous,
        undoStack: undoStack.slice(0, -1),
        redoStack: [...redoStack, state],
        dirty: true,
      });
      scheduleAutosave();
    },

    redo: () => {
      const { undoStack, redoStack, state } = get();
      if (redoStack.length === 0) return;
      const next = redoStack[redoStack.length - 1];
      set({
        state: next,
        redoStack: redoStack.slice(0, -1),
        undoStack: [...undoStack, state],
        dirty: true,
      });
      scheduleAutosave();
    },

    saveNow: async () => {
      const { boardId, state, revision, dirty } = get();
      if (!boardId || !dirty) return;
      set({ saveStatus: 'saving' });
      try {
        const res = await canvasBoardApi.saveStateWithVersion(
          boardId,
          { state },
          revision,
        );
        set({
          revision: res.data.boardRevision,
          state: { ...state, boardRevision: res.data.boardRevision },
          dirty: false,
          saveStatus: 'saved',
        });
      } catch (error) {
        const conflict = extractConflict(error);
        if (conflict) {
          // Adopt server state (minimal V1 rebase: keep local selection/viewport).
          const { selectedNodeIds, state: local } = get();
          set({
            state: { ...normalizeCanvasBoardState(conflict.serverState), viewport: local.viewport },
            revision: conflict.serverRevision,
            selectedNodeIds,
            saveStatus: 'conflict',
            dirty: false,
            errorMessage: '画布已在其他窗口更新，已载入最新版本',
          });
          return;
        }
        set({ saveStatus: 'error', errorMessage: toMessage(error) });
      }
    },

    generateImage: async ({ selectedNodeIds, modelConfigId, count }) => {
      const { boardId, entitlement } = get();
      if (!boardId) return;
      if (!entitlement.canGenerate) {
        set({ errorMessage: entitlement.reason ?? '该功能需要开通会员' });
        return;
      }

      const seed = get().state.nodes.length + 1;
      const placeholderId = clientId('cph', seed);
      const [placement] = placeGeneratedNodesNearSource(get().state, selectedNodeIds, 1);
      const placeholder: GenerationTaskCanvasNode = {
        id: clientId('ph', seed),
        kind: 'generationTask',
        x: placement?.x ?? 0,
        y: placement?.y ?? 0,
        width: 320,
        height: 320,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        clientPlaceholderId: placeholderId,
        taskStatus: 'running',
      };

      // Optimistic placeholder — not part of the undo stack.
      set({ state: { ...get().state, nodes: [...get().state.nodes, placeholder] } });

      const body: CanvasImageGenerateInput = {
        idempotencyKey: placeholderId,
        clientPlaceholderId: placeholderId,
        selectedNodeIds,
        modelConfigId,
        count,
      };

      try {
        await canvasBoardApi.generateImage(boardId, body);
        // Backend merged the result server-side; reload authoritative state.
        const res = await canvasBoardApi.getState(boardId);
        applyServerResponse(res.data);
      } catch (error) {
        // Roll back the optimistic placeholder, surface the error.
        set({
          state: {
            ...get().state,
            nodes: markPlaceholderFailed(get().state.nodes, placeholderId, toMessage(error)),
          },
          errorMessage: toMessage(error),
        });
      }
    },

    resumeRunningActions: async () => {
      const { boardId } = get();
      if (!boardId) return;
      try {
        const res = await canvasBoardApi.listRunningActions(boardId);
        const running = res.data ?? [];
        set({ runningActions: running });
        if (running.length === 0) {
          const stateRes = await canvasBoardApi.getState(boardId);
          applyServerResponse(stateRes.data);
        } else {
          ensureActionPolling();
        }
      } catch {
        // transient; next tick retries
      }
    },

    reset: () => {
      clearTimers();
      set({
        boardId: null,
        board: null,
        state: createEmptyCanvasBoardState(1),
        revision: 1,
        entitlement: CANVAS_FREE_TIER_ENTITLEMENT,
        selectedNodeIds: [],
        runningActions: [],
        estimate: null,
        loading: false,
        saveStatus: 'idle',
        dirty: false,
        errorMessage: null,
        undoStack: [],
        redoStack: [],
      });
    },
  };
});

function markPlaceholderFailed(nodes: CanvasNode[], placeholderId: string, error: string): CanvasNode[] {
  return nodes.map((node) =>
    node.kind === 'generationTask' && node.clientPlaceholderId === placeholderId
      ? { ...node, taskStatus: 'failed' as const, error }
      : node,
  );
}

interface ConflictPayload {
  serverRevision: number;
  serverState: CanvasBoardState;
}

function extractConflict(error: unknown): ConflictPayload | null {
  const body = readResponseBody(error);
  if (body && typeof body === 'object' && 'serverState' in body && 'serverRevision' in body) {
    const b = body as { serverRevision: number; serverState: CanvasBoardState };
    if (b.serverState) return { serverRevision: b.serverRevision, serverState: b.serverState };
  }
  return null;
}

function readResponseBody(error: unknown): unknown {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { data?: unknown } }).response;
    return response?.data ?? null;
  }
  return null;
}

function toMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const withMsg = error as { msg?: string; message?: string };
    return withMsg.msg ?? withMsg.message ?? '操作失败';
  }
  return '操作失败';
}
