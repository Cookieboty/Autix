import { create } from 'zustand';
import { ChatMessage, UIStage, AIUIResponse } from '@/types/ai-ui';

interface AIUIStore {
  messages: ChatMessage[];
  currentStage: UIStage | null;
  streamingMessage: ChatMessage | null;
  isWaitingForUser: boolean;
  isStreaming: boolean;
  
  addMessage: (message: ChatMessage) => void;
  updateStreamingMessage: (content: string, uiResponse?: AIUIResponse) => void;
  finalizeStreaming: () => void;
  setStage: (stage: UIStage | null) => void;
  clearMessages: () => void;
  reset: () => void;
}

export const useAIUIStore = create<AIUIStore>((set) => ({
  messages: [],
  currentStage: null,
  streamingMessage: null,
  isWaitingForUser: false,
  isStreaming: false,
  
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message],
  })),
  
  updateStreamingMessage: (content, uiResponse) => set((state) => {
    const existing = state.streamingMessage || {
      id: `temp-${Date.now()}`,
      role: 'assistant' as const,
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };
    
    return {
      streamingMessage: {
        ...existing,
        content: existing.content + content,
        uiResponse: uiResponse || existing.uiResponse,
      },
      isStreaming: true,
    };
  }),
  
  finalizeStreaming: () => set((state) => {
    if (!state.streamingMessage) return state;
    
    return {
      messages: [...state.messages, { ...state.streamingMessage, isStreaming: false }],
      streamingMessage: null,
      isStreaming: false,
      isWaitingForUser: !!state.streamingMessage.uiResponse,
    };
  }),
  
  setStage: (stage) => set({ currentStage: stage }),
  
  clearMessages: () => set({ messages: [], streamingMessage: null }),
  
  reset: () => set({
    messages: [],
    currentStage: null,
    streamingMessage: null,
    isWaitingForUser: false,
    isStreaming: false,
  }),
}));
