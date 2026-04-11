import { create } from 'zustand';

export interface TaskEvent {
  id: string;
  taskType: string;
  taskId: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  message?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  readAt?: string;
}

interface TaskState {
  events: TaskEvent[];
  isConnected: boolean;
  error: string | null;
  addEvent: (e: TaskEvent) => void;
  markRead: (taskId: string) => void;
  setConnected: (v: boolean) => void;
  loadHistory: () => Promise<void>;
  setError: (msg: string | null) => void;
}

export const useTaskStore = create<TaskState>((set) => ({
  events: [],
  isConnected: false,
  error: null,

  addEvent: (e) =>
    set((s) => {
      if (s.events.some((existing) => existing.id === e.id)) return s;
      return { events: [{ ...e, readAt: undefined }, ...s.events] };
    }),

  markRead: (taskId) =>
    set((s) => ({
      events: s.events.map((e) =>
        e.taskId === taskId && !e.readAt
          ? { ...e, readAt: new Date().toISOString() }
          : e
      ),
    })),

  setConnected: (v) => set({ isConnected: v }),

  loadHistory: async () => {
    try {
      const { getTaskHistory } = await import('../lib/api');
      const data = await getTaskHistory({ pageSize: 50 });
      set({ events: data.items, error: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载失败';
      console.error('[taskStore] loadHistory failed:', err);
      set({ error: msg });
    }
  },

  setError: (msg) => set({ error: msg }),
}));
