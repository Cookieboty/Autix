import { create } from 'zustand';
import type { ChatMessage, UIStage, AIUIResponse } from '@autix/shared-lib';

interface ProgressInfo {
  agent: string;
  agentDisplayName: string;
  step: number;
  totalSteps: number;
  status: 'started' | 'completed';
}

interface AIUIStore {
  messages: ChatMessage[];
  currentStage: UIStage | null;
  streamingMessage: ChatMessage | null;
  isWaitingForUser: boolean;
  isStreaming: boolean;
  currentProgress: ProgressInfo | null;

  addMessage: (message: ChatMessage) => void;
  setMessages: (messages: ChatMessage[]) => void;
  updateStreamingMessage: (content: string, uiResponse?: AIUIResponse) => void;
  finalizeStreaming: () => void;
  setStage: (stage: UIStage | null) => void;
  setProgress: (progress: ProgressInfo | null) => void;
  clearProgress: () => void;
  clearMessages: () => void;
  reset: () => void;
}

export const useAIUIStore = create<AIUIStore>((set) => ({
  messages: [],
  currentStage: null,
  streamingMessage: null,
  isWaitingForUser: false,
  isStreaming: false,
  currentProgress: null,

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  setMessages: (messages) => set({ messages, streamingMessage: null }),

  updateStreamingMessage: (content, uiResponse) =>
    set((state) => {
      const existing: ChatMessage = state.streamingMessage || {
        id: `temp-${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
        messageType: 'markdown',
      };

      const newStreamingMessage: ChatMessage = {
        ...existing,
        content: (existing.content ?? '') + content,
        uiResponse: uiResponse || existing.uiResponse,
        thinking: uiResponse?.thinking ?? existing.thinking,
        messageType: uiResponse ? 'ui' : existing.messageType,
      };

      return {
        streamingMessage: newStreamingMessage,
        isStreaming: true,
      };
    }),

  finalizeStreaming: () =>
    set((state) => {
      if (!state.streamingMessage) return state;

      const finalizedMessage: ChatMessage = {
        ...state.streamingMessage,
        isStreaming: false,
      };

      return {
        messages: [...state.messages, finalizedMessage],
        streamingMessage: null,
        isStreaming: false,
        isWaitingForUser: !!state.streamingMessage.uiResponse,
        currentProgress: null,
      };
    }),

  setStage: (stage) => set({ currentStage: stage }),
  setProgress: (progress) => set({ currentProgress: progress }),
  clearProgress: () => set({ currentProgress: null }),
  clearMessages: () => set({ messages: [], streamingMessage: null }),
  reset: () =>
    set({
      messages: [],
      currentStage: null,
      streamingMessage: null,
      isWaitingForUser: false,
      isStreaming: false,
      currentProgress: null,
    }),
}));
