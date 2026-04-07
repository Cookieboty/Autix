import { create } from 'zustand';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'autix_chat_sessions';
const MAX_SESSIONS = 50;

function loadSessions(): ChatSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]) {
  if (typeof window === 'undefined') return;
  const trimmed = sessions.slice(0, MAX_SESSIONS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function generateTitle(firstMessage: string): string {
  return firstMessage.slice(0, 30) + (firstMessage.length > 30 ? '...' : '');
}

interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  isStreaming: boolean;

  createSession: () => string;
  setActiveSession: (id: string) => void;
  deleteSession: (id: string) => void;
  addMessage: (sessionId: string, message: Omit<Message, 'id'>) => void;
  appendToLastAssistantMessage: (sessionId: string, chunk: string) => void;
  setStreaming: (value: boolean) => void;
  getActiveSession: () => ChatSession | null;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: loadSessions(),
  activeSessionId: null,
  isStreaming: false,

  createSession: () => {
    const id = generateId();
    const now = new Date().toISOString();
    const newSession: ChatSession = {
      id,
      title: '新对话',
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    set((state) => {
      const sessions = [newSession, ...state.sessions];
      saveSessions(sessions);
      return { sessions, activeSessionId: id };
    });
    return id;
  },

  setActiveSession: (id) => set({ activeSessionId: id }),

  deleteSession: (id) => {
    set((state) => {
      const sessions = state.sessions.filter((s) => s.id !== id);
      saveSessions(sessions);
      const activeSessionId =
        state.activeSessionId === id
          ? (sessions[0]?.id ?? null)
          : state.activeSessionId;
      return { sessions, activeSessionId };
    });
  },

  addMessage: (sessionId, message) => {
    set((state) => {
      const sessions = state.sessions.map((s) => {
        if (s.id !== sessionId) return s;
        const newMsg: Message = { ...message, id: generateId() };
        const messages = [...s.messages, newMsg];
        const title =
          s.messages.length === 0 && message.role === 'user'
            ? generateTitle(message.content)
            : s.title;
        return { ...s, messages, title, updatedAt: new Date().toISOString() };
      });
      saveSessions(sessions);
      return { sessions };
    });
  },

  appendToLastAssistantMessage: (sessionId, chunk) => {
    set((state) => {
      const sessions = state.sessions.map((s) => {
        if (s.id !== sessionId) return s;
        const messages = [...s.messages];
        const last = messages[messages.length - 1];
        if (last && last.role === 'assistant') {
          messages[messages.length - 1] = { ...last, content: last.content + chunk };
        }
        return { ...s, messages, updatedAt: new Date().toISOString() };
      });
      saveSessions(sessions);
      return { sessions };
    });
  },

  setStreaming: (value) => set({ isStreaming: value }),

  getActiveSession: () => {
    const { sessions, activeSessionId } = get();
    return sessions.find((s) => s.id === activeSessionId) ?? null;
  },
}));
