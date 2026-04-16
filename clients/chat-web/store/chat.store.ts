import { create } from 'zustand';
import {
  getConversations,
  createConversation,
  deleteConversation,
  getConversationMessages,
  getAvailableModels,
  type Conversation,
  type ConversationMessage,
  type ModelConfigItem,
} from '@/lib/api';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: {
    uiResponse?: any;
    uiStage?: string;
    [key: string]: any;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  messagesLoaded: boolean;
}

function toLocalMessage(m: ConversationMessage): Message {
  return {
    id: m.id,
    role: m.role === 'USER' ? 'user' : 'assistant',
    content: m.content,
    timestamp: m.createdAt,
    metadata: m.metadata,
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

  fetchSessions: () => Promise<void>;
  createSession: (title?: string) => Promise<string>;
  setActiveSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  addMessage: (sessionId: string, message: Omit<Message, 'id'>) => void;
  appendToLastAssistantMessage: (sessionId: string, chunk: string) => void;
  setStreaming: (value: boolean) => void;
  getActiveSession: () => ChatSession | null;
  fetchAvailableModels: () => Promise<void>;
  setSelectedModel: (id: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  isStreaming: false,
  isLoadingSessions: false,
  availableModels: [],
  selectedModelId: null,

  fetchSessions: async () => {
    set({ isLoadingSessions: true });
    try {
      const res = await getConversations();
      const sessions: ChatSession[] = (res.data as Conversation[]).map((c) => ({
        id: c.id,
        title: c.title || '新对话',
        messages: [],
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        messagesLoaded: false,
      }));
      set({ sessions });
    } catch {
      // 网络错误时保留空列表
    } finally {
      set({ isLoadingSessions: false });
    }
  },

  createSession: async (title?: string) => {
    const res = await createConversation(title);
    const c = res.data as Conversation;
    const newSession: ChatSession = {
      id: c.id,
      title: c.title || '新对话',
      messages: [],
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messagesLoaded: true,
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
      // 默认选中 isDefault=true 的模型（私人默认优先，再公开默认）
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
}));
