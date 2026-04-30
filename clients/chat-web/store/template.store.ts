import { create } from 'zustand';
import {
  templateApi,
  generationApi,
  type PromptTemplate,
  type TemplateGeneration,
  type TemplateStatus,
  type PaginatedResult,
} from '@/lib/api';

// ── Store ─────────────────────────────────────────────────────────────────────

interface TemplateState {
  // Market
  templates: PromptTemplate[];
  total: number;
  page: number;
  loading: boolean;
  category: string;
  search: string;
  sort: 'newest' | 'popular' | 'likes';

  // Current template detail
  currentTemplate: PromptTemplate | null;

  // Generation
  currentGeneration: TemplateGeneration | null;
  generating: boolean;

  // Actions
  setCategory: (category: string) => void;
  setSearch: (search: string) => void;
  setSort: (sort: 'newest' | 'popular' | 'likes') => void;
  fetchTemplates: (page?: number) => Promise<void>;
  fetchTemplate: (id: string) => Promise<void>;
  likeTemplate: (id: string) => Promise<void>;

  createGeneration: (templateId: string, data: {
    modelUsed: string;
    variables: Record<string, string>;
    referenceImage?: string;
  }) => Promise<TemplateGeneration>;
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
      const data = res.data as any;
      set({
        templates: data.items ?? data,
        total: data.total ?? 0,
        page: data.page ?? page,
      });
    } finally {
      set({ loading: false });
    }
  },

  fetchTemplate: async (id) => {
    const res = await templateApi.getById(id);
    set({ currentTemplate: res.data as any });
  },

  likeTemplate: async (id) => {
    await templateApi.like(id);
    const current = get().currentTemplate;
    if (current?.id === id) {
      set({ currentTemplate: { ...current, likeCount: current.likeCount + 1 } });
    }
  },

  createGeneration: async (templateId, data) => {
    const res = await templateApi.createGeneration(templateId, data);
    const gen = res.data as any;
    set({ currentGeneration: gen });
    return gen;
  },

  fetchGeneration: async (id) => {
    const res = await generationApi.getById(id);
    set({ currentGeneration: res.data as any });
  },

  setCurrentGeneration: (gen) => set({ currentGeneration: gen }),
  setGenerating: (v) => set({ generating: v }),
}));
