import { create } from 'zustand';
import { ChatMessage, UIStage, AIUIResponse } from '@/types/ai-ui';

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
  
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message],
  })),
  
  setMessages: (messages) => set({ messages, streamingMessage: null }),
  
  updateStreamingMessage: (content, uiResponse) => set((state) => {
    const existing = state.streamingMessage || {
      id: `temp-${Date.now()}`,
      role: 'assistant' as const,
      content: '',
      timestamp: new Date(),
      isStreaming: true,
      messageType: 'markdown' as const,
    };
    
    const newStreamingMessage = {
      ...existing,
      content: existing.content + content,
      uiResponse: uiResponse || existing.uiResponse,
      thinking: uiResponse?.thinking || existing.thinking,
      messageType: uiResponse ? ('ui' as const) : existing.messageType,
    };
    
    return {
      streamingMessage: newStreamingMessage,
      isStreaming: true,
    };
  }),
  
  finalizeStreaming: () => set((state) => {
    if (!state.streamingMessage) {
      return state;
    }
    
    const finalizedMessage = { ...state.streamingMessage, isStreaming: false };
    
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
  
  reset: () => set({
    messages: [],
    currentStage: null,
    streamingMessage: null,
    isWaitingForUser: false,
    isStreaming: false,
    currentProgress: null,
  }),
}));
