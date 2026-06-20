import { create } from 'zustand';
import {
  getConversations,
  createConversation,
  deleteConversation,
  getConversationMessages,
  getAvailableModels,
  type Conversation,
  type ConversationKind,
  type ConversationMessage,
  type ModelConfigItem,
} from '@autix/sdk';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  messageType?: string;
  uiResponse?: unknown;
  thinking?: string;
  metadata?: Record<string, unknown>;
  durationMs?: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  messagesLoaded: boolean;
  // 会话打标 + 列表统一展示需要的元数据
  kind: ConversationKind;
  agentId: string | null;
  agentName: string | null;
  projectMeta: { projectId: string; status: string; clipCount: number } | null;
}

function toLocalMessage(m: ConversationMessage): Message {
  const ui = m.uiResponse as { thinking?: string } | undefined;
  const rawTimestamp =
    (m as any).createdAt ?? (m as any).timestamp ?? new Date().toISOString();
  const metadata = (m.metadata ?? {}) as Record<string, unknown>;
  const topLevelDuration = (m as any).durationMs;
  const durationMs =
    typeof topLevelDuration === 'number'
      ? topLevelDuration
      : typeof metadata.durationMs === 'number'
        ? (metadata.durationMs as number)
        : undefined;
  return {
    id: m.id,
    role: m.role === 'USER' ? 'user' : 'assistant',
    content: m.content,
    timestamp: rawTimestamp,
    messageType: m.messageType,
    uiResponse: m.uiResponse,
    thinking: m.thinking || ui?.thinking,
    metadata,
    durationMs,
  };
}

function generateTempId() {
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  isStreaming: boolean;
  isLoadingSessions: boolean;
  availableModels: ModelConfigItem[];
  selectedModelId: string | null;
  selectedChatModelId: string | null;

  fetchSessions: (kind?: ConversationKind) => Promise<void>;
  createSession: (
    title?: string,
    options?: { kind?: ConversationKind; agentId?: string | null },
  ) => Promise<string>;
  setActiveSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  addMessage: (sessionId: string, message: Omit<Message, 'id'>) => void;
  appendToLastAssistantMessage: (sessionId: string, chunk: string) => void;
  setStreaming: (value: boolean) => void;
  getActiveSession: () => ChatSession | null;
  fetchAvailableModels: () => Promise<void>;
  setSelectedModel: (id: string) => void;
  setSelectedChatModel: (id: string | null) => void;
  setSessionKind: (id: string, kind: ConversationKind) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  isStreaming: false,
  isLoadingSessions: false,
  availableModels: [],
  selectedModelId: null,
  selectedChatModelId: null,

  fetchSessions: async (kind?: ConversationKind) => {
    set({ isLoadingSessions: true });
    try {
      const res = await getConversations(kind);
      const sessions: ChatSession[] = (res.data as Conversation[]).map((c) => ({
        id: c.id,
        title: c.title || '新对话',
        messages: [],
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        messagesLoaded: false,
        kind: c.kind ?? 'chat',
        agentId: c.agentId ?? null,
        agentName: c.agent?.name ?? null,
        projectMeta: c.projectMeta ?? null,
      }));
      set({ sessions });
    } catch {
      // 网络错误时保留空列表
    } finally {
      set({ isLoadingSessions: false });
    }
  },

  createSession: async (
    title?: string,
    options?: { kind?: ConversationKind; agentId?: string | null },
  ) => {
    const res = await createConversation(
      options
        ? { title, kind: options.kind, agentId: options.agentId ?? null }
        : title,
    );
    const c = res.data as Conversation;
    const newSession: ChatSession = {
      id: c.id,
      title: c.title || '新对话',
      messages: [],
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messagesLoaded: true,
      kind: c.kind ?? options?.kind ?? 'chat',
      agentId: c.agentId ?? options?.agentId ?? null,
      agentName: c.agent?.name ?? null,
      projectMeta: c.projectMeta ?? null,
    };
    set((state) => ({
      sessions: [newSession, ...state.sessions],
      activeSessionId: c.id,
    }));
    return c.id;
  },

  setActiveSession: async (id: string) => {
    set({ activeSessionId: id });
    const { sessions } = get();
    const session = sessions.find((s) => s.id === id);
    if (!session || session.messagesLoaded) return;

    try {
      const res = await getConversationMessages(id);
      const messages = (res.data as ConversationMessage[]).map(toLocalMessage);
      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === id ? { ...s, messages, messagesLoaded: true } : s,
        ),
      }));
    } catch {
      // 加载失败静默处理
    }
  },

  deleteSession: async (id: string) => {
    try {
      await deleteConversation(id);
    } catch {
      // 删除失败也从本地移除
    }
    set((state) => {
      const sessions = state.sessions.filter((s) => s.id !== id);
      const activeSessionId =
        state.activeSessionId === id ? (sessions[0]?.id ?? null) : state.activeSessionId;
      return { sessions, activeSessionId };
    });
  },

  addMessage: (sessionId, message) => {
    set((state) => ({
      sessions: state.sessions.map((s) => {
        if (s.id !== sessionId) return s;
        const newMsg: Message = { ...message, id: generateTempId() };
        return {
          ...s,
          messages: [...s.messages, newMsg],
          updatedAt: new Date().toISOString(),
        };
      }),
    }));
  },

  appendToLastAssistantMessage: (sessionId, chunk) => {
    set((state) => ({
      sessions: state.sessions.map((s) => {
        if (s.id !== sessionId) return s;
        const messages = [...s.messages];
        const last = messages[messages.length - 1];
        if (last && last.role === 'assistant') {
          messages[messages.length - 1] = { ...last, content: last.content + chunk };
        }
        return { ...s, messages, updatedAt: new Date().toISOString() };
      }),
    }));
  },

  setStreaming: (value) => set({ isStreaming: value }),

  getActiveSession: () => {
    const { sessions, activeSessionId } = get();
    return sessions.find((s) => s.id === activeSessionId) ?? null;
  },

  fetchAvailableModels: async () => {
    try {
      const res = await getAvailableModels();
      const models = res.data as ModelConfigItem[];
      set({ availableModels: models });
      const defaultModel = models.find((m) => m.isDefault);
      if (defaultModel) {
        set({ selectedModelId: defaultModel.id });
      } else if (models.length > 0) {
        set({ selectedModelId: models[0].id });
      }
    } catch {
      // 网络错误不阻断
    }
  },

  setSelectedModel: (id: string) => set({ selectedModelId: id }),
  setSelectedChatModel: (id) => set({ selectedChatModelId: id }),
  setSessionKind: (id, kind) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, kind } : s,
      ),
    }));
  },
}));
