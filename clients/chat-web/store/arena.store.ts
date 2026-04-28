import { create } from 'zustand';
import {
  arenaApi,
  getAvailableModels,
  type ArenaSession,
  type ArenaTurn,
  type ArenaResponseRecord,
  type ModelConfigItem,
} from '@/lib/api';
import { type ModelCategory } from '@/lib/model-category';
import { type ModelParamsConfig } from '@/lib/model-params';

const MODEL_PARAMS_STORAGE_KEY = 'arena_model_params';

function loadModelParamsMap(): Record<string, ModelParamsConfig> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(MODEL_PARAMS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveModelParamsMap(map: Record<string, ModelParamsConfig>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MODEL_PARAMS_STORAGE_KEY, JSON.stringify(map));
  } catch { /* quota exceeded, etc. */ }
}

export interface LocalArenaResponse {
  id: string;
  modelId: string;
  modelName: string;
  content: string;
  responseImages: string[];
  status: 'pending' | 'streaming' | 'completed' | 'error';
  durationMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  error: string | null;
  startTime: number | null;
}

export interface LocalArenaTurn {
  id: string;
  userMessage: string;
  images?: string[];
  responses: LocalArenaResponse[];
  createdAt: string;
}

export interface LocalArenaSession {
  id: string;
  title: string;
  turns: LocalArenaTurn[];
  createdAt: string;
  updatedAt: string;
  turnsLoaded: boolean;
}

interface ArenaState {
  sessions: LocalArenaSession[];
  activeSessionId: string | null;
  selectedModelIds: string[];
  activeCategory: ModelCategory;
  availableModels: ModelConfigItem[];
  modelParamsMap: Record<string, ModelParamsConfig>;
  isStreaming: boolean;
  isLoadingSessions: boolean;

  fetchSessions: () => Promise<void>;
  createSession: (title?: string) => Promise<string>;
  setActiveSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  clearTurns: () => Promise<void>;
  setSelectedModels: (ids: string[]) => void;
  setActiveCategory: (category: ModelCategory) => void;
  setModelParams: (modelId: string, config: ModelParamsConfig) => void;
  resetModelParams: (modelId: string) => void;
  fetchAvailableModels: () => Promise<void>;
  getActiveSession: () => LocalArenaSession | null;
  setStreaming: (value: boolean) => void;

  addTurn: (turnId: string, userMessage: string, responses: { id: string; modelConfigId: string }[], images?: string[]) => void;
  setResponseStreaming: (modelId: string) => void;
  appendToResponse: (modelId: string, content: string) => void;
  appendImageToResponse: (modelId: string, imageUrl: string) => void;
  finalizeResponse: (modelId: string, meta: {
    durationMs?: number;
    promptTokens?: number | null;
    completionTokens?: number | null;
    totalTokens?: number | null;
  }) => void;
  setResponseError: (modelId: string, error: string) => void;
}

function mapDbTurn(
  turn: ArenaTurn,
  models: ModelConfigItem[],
): LocalArenaTurn {
  return {
    id: turn.id,
    userMessage: turn.userMessage,
    images: turn.images?.length ? turn.images : undefined,
    createdAt: turn.createdAt,
    responses: turn.responses.map((r) => mapDbResponse(r, models)),
  };
}

function mapDbResponse(
  r: ArenaResponseRecord,
  models: ModelConfigItem[],
): LocalArenaResponse {
  const model = models.find((m) => m.id === r.modelConfigId);
  return {
    id: r.id,
    modelId: r.modelConfigId,
    modelName: model?.name ?? r.modelConfigId,
    content: r.content,
    responseImages: [],
    status: r.status as LocalArenaResponse['status'],
    durationMs: r.durationMs,
    promptTokens: r.promptTokens,
    completionTokens: r.completionTokens,
    totalTokens: r.totalTokens,
    error: r.error,
    startTime: null,
  };
}

export const useArenaStore = create<ArenaState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  selectedModelIds: [],
  activeCategory: 'text' as ModelCategory,
  availableModels: [],
  modelParamsMap: loadModelParamsMap(),
  isStreaming: false,
  isLoadingSessions: false,

  fetchAvailableModels: async () => {
    try {
      const res = await getAvailableModels();
      const models = res.data as ModelConfigItem[];
      set({ availableModels: models });
    } catch {
      // silent
    }
  },

  fetchSessions: async () => {
    set({ isLoadingSessions: true });
    try {
      const res = await arenaApi.getSessions();
      const data = res.data as ArenaSession[];
      const sessions: LocalArenaSession[] = data.map((s) => ({
        id: s.id,
        title: s.title,
        turns: [],
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        turnsLoaded: false,
      }));
      set({ sessions });
    } catch {
      // silent
    } finally {
      set({ isLoadingSessions: false });
    }
  },

  createSession: async (title?: string) => {
    const res = await arenaApi.createSession(title);
    const s = res.data as ArenaSession;
    const newSession: LocalArenaSession = {
      id: s.id,
      title: s.title,
      turns: [],
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      turnsLoaded: true,
    };
    set((state) => ({
      sessions: [newSession, ...state.sessions],
      activeSessionId: s.id,
    }));
    return s.id;
  },

  setActiveSession: async (id: string) => {
    set({ activeSessionId: id });
    const { sessions, availableModels } = get();
    const session = sessions.find((s) => s.id === id);
    if (!session || session.turnsLoaded) return;

    try {
      const res = await arenaApi.getSession(id);
      const data = res.data as ArenaSession;
      const turns = (data.turns ?? []).map((t) =>
        mapDbTurn(t, availableModels),
      );
      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === id ? { ...s, turns, turnsLoaded: true } : s,
        ),
        selectedModelIds: data.selectedModelIds?.length ? data.selectedModelIds : state.selectedModelIds,
      }));
    } catch {
      // silent
    }
  },

  deleteSession: async (id: string) => {
    try {
      await arenaApi.deleteSession(id);
    } catch {
      // still remove locally
    }
    set((state) => {
      const sessions = state.sessions.filter((s) => s.id !== id);
      const activeSessionId =
        state.activeSessionId === id
          ? (sessions[0]?.id ?? null)
          : state.activeSessionId;
      return { sessions, activeSessionId };
    });
  },

  clearTurns: async () => {
    const { activeSessionId } = get();
    if (!activeSessionId) return;
    try {
      await arenaApi.clearTurns(activeSessionId);
    } catch {
      // still clear locally
    }
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === activeSessionId ? { ...s, turns: [] } : s,
      ),
    }));
  },

  setSelectedModels: (ids: string[]) => {
    set({ selectedModelIds: ids });
    const { activeSessionId } = get();
    if (activeSessionId) {
      arenaApi.updateSelectedModels(activeSessionId, ids).catch(() => {});
    }
  },

  setActiveCategory: (category: ModelCategory) => {
    set({ activeCategory: category, selectedModelIds: [] });
    const { activeSessionId } = get();
    if (activeSessionId) {
      arenaApi.updateSelectedModels(activeSessionId, []).catch(() => {});
    }
  },

  setModelParams: (modelId: string, config: ModelParamsConfig) => {
    const newMap = { ...get().modelParamsMap, [modelId]: config };
    set({ modelParamsMap: newMap });
    saveModelParamsMap(newMap);
  },

  resetModelParams: (modelId: string) => {
    const newMap = { ...get().modelParamsMap };
    delete newMap[modelId];
    set({ modelParamsMap: newMap });
    saveModelParamsMap(newMap);
  },

  getActiveSession: () => {
    const { sessions, activeSessionId } = get();
    return sessions.find((s) => s.id === activeSessionId) ?? null;
  },

  setStreaming: (value: boolean) => set({ isStreaming: value }),

  addTurn: (turnId, userMessage, responses, images?) => {
    const { activeSessionId, availableModels } = get();
    if (!activeSessionId) return;

    const now = Date.now();
    const localResponses: LocalArenaResponse[] = responses.map((r) => {
      const model = availableModels.find((m) => m.id === r.modelConfigId);
      return {
        id: r.id,
        modelId: r.modelConfigId,
        modelName: model?.name ?? r.modelConfigId,
        content: '',
        responseImages: [],
        status: 'pending' as const,
        durationMs: null,
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
        error: null,
        startTime: now,
      };
    });

    const turn: LocalArenaTurn = {
      id: turnId,
      userMessage,
      images: images?.length ? images : undefined,
      responses: localResponses,
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      sessions: state.sessions.map((s) => {
        if (s.id !== activeSessionId) return s;
        return { ...s, turns: [...s.turns, turn] };
      }),
    }));
  },

  setResponseStreaming: (modelId: string) => {
    const { activeSessionId } = get();
    if (!activeSessionId) return;

    set((state) => ({
      sessions: state.sessions.map((s) => {
        if (s.id !== activeSessionId) return s;
        const turns = [...s.turns];
        const lastTurn = turns[turns.length - 1];
        if (!lastTurn) return s;
        turns[turns.length - 1] = {
          ...lastTurn,
          responses: lastTurn.responses.map((r) =>
            r.modelId === modelId ? { ...r, status: 'streaming' as const, startTime: Date.now() } : r,
          ),
        };
        return { ...s, turns };
      }),
    }));
  },

  appendToResponse: (modelId: string, content: string) => {
    const { activeSessionId } = get();
    if (!activeSessionId) return;

    set((state) => ({
      sessions: state.sessions.map((s) => {
        if (s.id !== activeSessionId) return s;
        const turns = [...s.turns];
        const lastTurn = turns[turns.length - 1];
        if (!lastTurn) return s;
        turns[turns.length - 1] = {
          ...lastTurn,
          responses: lastTurn.responses.map((r) =>
            r.modelId === modelId
              ? { ...r, content: r.content + content, status: 'streaming' as const }
              : r,
          ),
        };
        return { ...s, turns };
      }),
    }));
  },

  appendImageToResponse: (modelId: string, imageUrl: string) => {
    const { activeSessionId } = get();
    if (!activeSessionId) return;

    set((state) => ({
      sessions: state.sessions.map((s) => {
        if (s.id !== activeSessionId) return s;
        const turns = [...s.turns];
        const lastTurn = turns[turns.length - 1];
        if (!lastTurn) return s;
        turns[turns.length - 1] = {
          ...lastTurn,
          responses: lastTurn.responses.map((r) =>
            r.modelId === modelId
              ? { ...r, responseImages: [...r.responseImages, imageUrl], status: 'streaming' as const }
              : r,
          ),
        };
        return { ...s, turns };
      }),
    }));
  },

  finalizeResponse: (modelId, meta) => {
    const { activeSessionId } = get();
    if (!activeSessionId) return;

    set((state) => ({
      sessions: state.sessions.map((s) => {
        if (s.id !== activeSessionId) return s;
        const turns = [...s.turns];
        const lastTurn = turns[turns.length - 1];
        if (!lastTurn) return s;
        turns[turns.length - 1] = {
          ...lastTurn,
          responses: lastTurn.responses.map((r) =>
            r.modelId === modelId
              ? {
                  ...r,
                  status: 'completed' as const,
                  durationMs: meta.durationMs ?? r.durationMs,
                  promptTokens: meta.promptTokens ?? r.promptTokens,
                  completionTokens: meta.completionTokens ?? r.completionTokens,
                  totalTokens: meta.totalTokens ?? r.totalTokens,
                }
              : r,
          ),
        };
        return { ...s, turns };
      }),
    }));
  },

  setResponseError: (modelId: string, error: string) => {
    const { activeSessionId } = get();
    if (!activeSessionId) return;

    set((state) => ({
      sessions: state.sessions.map((s) => {
        if (s.id !== activeSessionId) return s;
        const turns = [...s.turns];
        const lastTurn = turns[turns.length - 1];
        if (!lastTurn) return s;
        turns[turns.length - 1] = {
          ...lastTurn,
          responses: lastTurn.responses.map((r) =>
            r.modelId === modelId
              ? { ...r, status: 'error' as const, error }
              : r,
          ),
        };
        return { ...s, turns };
      }),
    }));
  },
}));
