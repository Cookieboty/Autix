import { create } from 'zustand';
import {
  imageTemplateApi,
  imageGenerationApi,
  type ImageGeneration,
} from '@autix/sdk';

interface ImageGenerationState {
  currentGeneration: ImageGeneration | null;
  generating: boolean;

  createGeneration: (
    templateId: string,
    data: {
      modelUsed: string;
      variables: Record<string, string>;
      referenceImage?: string;
    },
  ) => Promise<ImageGeneration>;

  fetchGeneration: (id: string) => Promise<void>;
  setCurrentGeneration: (gen: ImageGeneration | null) => void;
  setGenerating: (v: boolean) => void;
}

export const useImageGenerationStore = create<ImageGenerationState>((set) => ({
  currentGeneration: null,
  generating: false,

  createGeneration: async (templateId, data) => {
    const res = await imageTemplateApi.createGeneration(templateId, data);
    const gen = res.data as ImageGeneration;
    set({ currentGeneration: gen });
    return gen;
  },

  fetchGeneration: async (id) => {
    const res = await imageGenerationApi.getById(id);
    set({ currentGeneration: res.data as ImageGeneration });
  },

  setCurrentGeneration: (gen) => set({ currentGeneration: gen }),
  setGenerating: (v) => set({ generating: v }),
}));
