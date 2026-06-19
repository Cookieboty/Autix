import { create } from 'zustand';
import {
  templateApi,
  generationApi,
  type PromptTemplate,
  type TemplateGeneration,
} from '@autix/sdk';

interface TemplateState {
  templates: PromptTemplate[];
  total: number;
  page: number;
  loading: boolean;
  category: string;
  search: string;
  sort: 'newest' | 'popular' | 'likes';

  currentTemplate: PromptTemplate | null;
  currentGeneration: TemplateGeneration | null;
  generating: boolean;

  setCategory: (category: string) => void;
  setSearch: (search: string) => void;
  setSort: (sort: 'newest' | 'popular' | 'likes') => void;
  fetchTemplates: (page?: number) => Promise<void>;
  fetchTemplate: (id: string) => Promise<void>;
  createTemplate: (data: Partial<PromptTemplate>) => Promise<void>;
  updateTemplate: (id: string, data: Partial<PromptTemplate>) => Promise<void>;
  likeTemplate: (id: string) => Promise<void>;

  createGeneration: (
    templateId: string,
    data: {
      modelUsed: string;
      variables: Record<string, string>;
      referenceImage?: string;
    },
  ) => Promise<TemplateGeneration>;
  fetchGeneration: (id: string) => Promise<void>;
  setCurrentGeneration: (gen: TemplateGeneration | null) => void;
  setGenerating: (v: boolean) => void;
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
  templates: [],
  total: 0,
  page: 1,
  loading: false,
  category: '',
  search: '',
  sort: 'newest',
  currentTemplate: null,
  currentGeneration: null,
  generating: false,

  setCategory: (category) => {
    set({ category });
    get().fetchTemplates(1);
  },
  setSearch: (search) => {
    set({ search });
    get().fetchTemplates(1);
  },
  setSort: (sort) => {
    set({ sort });
    get().fetchTemplates(1);
  },

  fetchTemplates: async (page = 1) => {
    set({ loading: true });
    try {
      const { category, search, sort } = get();
      const res = await templateApi.list({
        category: category || undefined,
        search: search || undefined,
        sort,
        page,
        pageSize: 20,
      });
      const data = res.data as unknown as {
        items?: PromptTemplate[];
        total?: number;
        page?: number;
      };
      set({
        templates: (data.items ?? (data as unknown as PromptTemplate[]) ?? []) as PromptTemplate[],
        total: data.total ?? 0,
        page: data.page ?? page,
      });
    } finally {
      set({ loading: false });
    }
  },

  fetchTemplate: async (id) => {
    const res = await templateApi.getById(id);
    set({ currentTemplate: res.data as PromptTemplate });
  },

  createTemplate: async (data) => {
    await templateApi.create(data);
  },

  updateTemplate: async (id, data) => {
    await templateApi.update(id, data);
  },

  likeTemplate: async (id) => {
    const res = await templateApi.like(id);
    const { liked } = res.data as { liked: boolean };
    const current = get().currentTemplate;
    if (current?.id === id) {
      set({
        currentTemplate: {
          ...current,
          likeCount: current.likeCount + (liked ? 1 : -1),
        },
      });
    }
  },

  createGeneration: async (templateId, data) => {
    const res = await templateApi.createGeneration(templateId, data);
    const gen = res.data as TemplateGeneration;
    set({ currentGeneration: gen });
    return gen;
  },

  fetchGeneration: async (id) => {
    const res = await generationApi.getById(id);
    set({ currentGeneration: res.data as TemplateGeneration });
  },

  setCurrentGeneration: (gen) => set({ currentGeneration: gen }),
  setGenerating: (v) => set({ generating: v }),
}));
