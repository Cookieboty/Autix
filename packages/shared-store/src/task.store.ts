import { create } from 'zustand';
import type { TaskEvent } from '@autix/domain';
import {
  authFetchEventSource,
  getApiUrl,
  getTaskHistory,
  markTaskRead,
  type FetchEventSourceInit,
} from '@autix/sdk';

export type { TaskEvent };

interface TaskState {
  events: TaskEvent[];
  isConnected: boolean;
  error: string | null;
  addEvent: (e: TaskEvent) => void;
  markRead: (taskId: string) => void;
  markReadRemote: (taskId: string) => Promise<void>;
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
        e.taskId === taskId && !e.readAt ? { ...e, readAt: new Date().toISOString() } : e,
      ),
    })),

  markReadRemote: async (taskId) => {
    set((s) => ({
      events: s.events.map((e) =>
        e.taskId === taskId && !e.readAt ? { ...e, readAt: new Date().toISOString() } : e,
      ),
    }));
    await markTaskRead(taskId);
  },

  setConnected: (v) => set({ isConnected: v }),

  loadHistory: async () => {
    try {
      const res = await getTaskHistory({ pageSize: 50 });
      const historyItems: TaskEvent[] = (res.data as { items: TaskEvent[] }).items;
      set((s) => {
        const historyIds = new Set(historyItems.map((e) => e.id));
        const localOnly = s.events.filter((e) => !historyIds.has(e.id));
        return { events: [...localOnly, ...historyItems], error: null };
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载失败';
      set({ error: msg });
    }
  },

  setError: (msg) => set({ error: msg }),
}));

export const taskActions = {
  connectTaskEvents: (init: FetchEventSourceInit) =>
    authFetchEventSource(getApiUrl('/api/sse/tasks'), init),
};
