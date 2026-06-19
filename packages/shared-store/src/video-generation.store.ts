import { create } from 'zustand';
import {
  videoTemplateApi,
  videoGenerationApi,
  type VideoGeneration,
} from '@autix/sdk';

interface VideoGenerationState {
  currentGeneration: VideoGeneration | null;
  generating: boolean;

  createGeneration: (
    templateId: string,
    data: {
      modelUsed: string;
      variables: Record<string, string>;
      referenceImage?: string;
    },
  ) => Promise<VideoGeneration>;

  fetchGeneration: (id: string) => Promise<void>;
  setCurrentGeneration: (gen: VideoGeneration | null) => void;
  setGenerating: (v: boolean) => void;
}

export const useVideoGenerationStore = create<VideoGenerationState>((set) => ({
  currentGeneration: null,
  generating: false,

  createGeneration: async (templateId, data) => {
    const res = await videoTemplateApi.createGeneration(templateId, data);
    const gen = res.data as VideoGeneration;
    set({ currentGeneration: gen });
    return gen;
  },

  fetchGeneration: async (id) => {
    const res = await videoGenerationApi.getById(id);
    set({ currentGeneration: res.data as VideoGeneration });
  },

  setCurrentGeneration: (gen) => set({ currentGeneration: gen }),
  setGenerating: (v) => set({ generating: v }),
}));
