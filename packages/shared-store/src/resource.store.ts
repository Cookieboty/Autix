import { create } from 'zustand';
import {
  imageTemplateApi,
  videoTemplateApi,
  skillApi,
  mcpApi,
  agentApi,
  acquisitionsApi,
  type AnyResource,
  type MarketplaceTypeSlug,
  type PaginatedResult,
  type ImageTemplate,
  type VideoTemplate,
  type Skill,
  type McpServer,
  type AgentResource,
  type ResourceType,
} from '@autix/shared-lib';

const API_BY_SLUG = {
  'image-templates': imageTemplateApi,
  'video-templates': videoTemplateApi,
  skills: skillApi,
  mcp: mcpApi,
  agents: agentApi,
} as const;

const TYPE_BY_SLUG: Record<MarketplaceTypeSlug, ResourceType> = {
  'image-templates': 'IMAGE_TEMPLATE',
  'video-templates': 'VIDEO_TEMPLATE',
  skills: 'SKILL',
  mcp: 'MCP',
  agents: 'AGENT',
};

const ACQUIRABLE_SLUGS = new Set<MarketplaceTypeSlug>(['skills', 'mcp', 'agents']);

function errorMessage(e: unknown): string {
  const data = (e as { response?: { data?: { message?: string } } })?.response
    ?.data?.message;
  if (typeof data === 'string') return data;
  if (e instanceof Error && e.message) return e.message;
  return '加载失败,请稍后重试';
}

type AnyResourceItem =
  | ImageTemplate
  | VideoTemplate
  | Skill
  | McpServer
  | AgentResource;

interface ResourceState {
  items: AnyResourceItem[];
  total: number;
  page: number;
  loading: boolean;
  error: string | null;

  category: string;
  search: string;
  sort: 'newest' | 'popular' | 'likes';
  currentSlug: MarketplaceTypeSlug | null;

  currentResource: AnyResourceItem | null;
  detailLoading: boolean;

  setCategory: (category: string) => void;
  setSearch: (search: string) => void;
  setSort: (sort: 'newest' | 'popular' | 'likes') => void;

  fetchList: (slug: MarketplaceTypeSlug, page?: number) => Promise<void>;
  fetchDetail: (
    slug: MarketplaceTypeSlug,
    id: string,
  ) => Promise<AnyResourceItem | null>;

  toggleFavorite: (slug: MarketplaceTypeSlug, id: string) => Promise<void>;
  acquire: (
    slug: 'skills' | 'mcp' | 'agents',
    resourceId: string,
  ) => Promise<{ newBalance: number }>;
}

export const useResourceStore = create<ResourceState>((set, get) => ({
  items: [],
  total: 0,
  page: 1,
  loading: false,
  error: null,

  category: '',
  search: '',
  sort: 'newest',
  currentSlug: null,

  currentResource: null,
  detailLoading: false,

  setCategory: (category) => {
    set({ category });
    const slug = get().currentSlug;
    if (slug) get().fetchList(slug, 1);
  },
  setSearch: (search) => {
    set({ search });
    const slug = get().currentSlug;
    if (slug) get().fetchList(slug, 1);
  },
  setSort: (sort) => {
    set({ sort });
    const slug = get().currentSlug;
    if (slug) get().fetchList(slug, 1);
  },

  fetchList: async (slug, page = 1) => {
    set({ loading: true, error: null, currentSlug: slug });
    try {
      const { category, search, sort } = get();
      const api = API_BY_SLUG[slug];
      const res = await api.list({
        category: category || undefined,
        search: search || undefined,
        sort,
        page,
        pageSize: 20,
      });
      const data = res.data as PaginatedResult<AnyResourceItem>;
      set({
        items: data.items ?? [],
        total: data.total ?? 0,
        page: data.page ?? page,
      });
    } catch (e) {
      set({ items: [], total: 0, error: errorMessage(e) });
    } finally {
      set({ loading: false });
    }
  },

  fetchDetail: async (slug, id) => {
    set({ detailLoading: true, error: null, currentResource: null });
    try {
      const api = API_BY_SLUG[slug];
      const res = await api.getById(id);
      const data = res.data as AnyResourceItem;
      set({ currentResource: data });
      return data;
    } catch (e) {
      set({ currentResource: null, error: errorMessage(e) });
      return null;
    } finally {
      set({ detailLoading: false });
    }
  },

  toggleFavorite: async (slug, id) => {
    const api = API_BY_SLUG[slug];
    const res = await api.favorite(id);
    const delta = res.data.favorited ? 1 : -1;
    const updateFavoriteCount = (item: AnyResourceItem): AnyResourceItem =>
      ({
        ...item,
        favoriteCount: Math.max(0, item.favoriteCount + delta),
      }) as AnyResourceItem;

    set((state) => ({
      currentResource:
        state.currentResource?.id === id
          ? updateFavoriteCount(state.currentResource)
          : state.currentResource,
      items: state.items.map((item) =>
        item.id === id ? updateFavoriteCount(item) : item,
      ),
    }));
  },

  acquire: async (slug, resourceId) => {
    if (!ACQUIRABLE_SLUGS.has(slug)) {
      throw new Error('该资源类型不支持获取(仅 skills/mcp/agents)');
    }
    const res = await acquisitionsApi.acquire(slug, resourceId);
    const payload = res.data as { newBalance: number };
    return { newBalance: payload.newBalance };
  },
}));

export const resourceTypeFromSlug = (slug: MarketplaceTypeSlug) =>
  TYPE_BY_SLUG[slug];
