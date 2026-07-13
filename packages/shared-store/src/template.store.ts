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

  setCategory: (category: string) => void;
  setSearch: (search: string) => void;
  setSort: (sort: 'newest' | 'popular' | 'likes') => void;
  fetchTemplates: (page?: number) => Promise<void>;
  fetchTemplate: (id: string) => Promise<void>;
  createTemplate: (data: Partial<PromptTemplate>) => Promise<void>;
  updateTemplate: (id: string, data: Partial<PromptTemplate>) => Promise<void>;
  likeTemplate: (id: string) => Promise<void>;

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

}));

export type { PromptTemplate, TemplateGeneration, TemplateStatus } from '@autix/sdk';

export interface TemplateListParams {
  authorId?: string;
  category?: string;
  search?: string;
  sort?: 'newest' | 'popular' | 'likes';
  page?: number;
  pageSize?: number;
}

export interface TemplateListResult {
  items: PromptTemplate[];
  total: number;
  page: number;
}

export const templateActions = {
  list: async (params?: TemplateListParams): Promise<TemplateListResult> => {
    const res = await templateApi.list(params);
    const data = res.data as unknown as {
      items?: PromptTemplate[];
      total?: number;
      page?: number;
    };
    return {
      items: data.items ?? [],
      total: data.total ?? 0,
      page: data.page ?? params?.page ?? 1,
    };
  },
  remove: (id: string) => templateApi.remove(id),
};
