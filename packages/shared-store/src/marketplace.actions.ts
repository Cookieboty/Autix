import {
  agentApi,
  acquisitionsApi,
  conversationResourcesApi,
  imageTemplateApi,
  marketplaceApi,
  meApi,
  mcpApi,
  skillApi,
  videoTemplateApi,
  type AgentExecutionMode,
  type AgentKind,
  type AgentResource,
  type AnyResource,
  type ConversationResourceLink,
  type ConversationKind,
  type ImageTemplate,
  type MarketplaceHome,
  type MarketplaceTypeSlug,
  type McpServer,
  type PaginatedResult,
  type PlatformStats,
  type RuntimeReq,
  type ResourceType,
  type Skill,
  type TemplateVariable,
  type VideoTemplate,
  type WorkflowStepDef,
} from '@autix/sdk';

export type {
  AgentExecutionMode,
  AgentKind,
  AgentResource,
  AnyResource,
  ConversationKind,
  ImageTemplate,
  MarketplaceHome,
  MarketplaceTypeSlug,
  McpServer,
  PlatformStats,
  RuntimeReq,
  ResourceType,
  Skill,
  TemplateVariable,
  VideoTemplate,
  WorkflowStepDef,
  ConversationResourceLink,
} from '@autix/sdk';

export type ImageTemplateCreateInput = Partial<ImageTemplate>;
export type VideoTemplateCreateInput = Partial<VideoTemplate>;
export type SkillCreateInput = Partial<Skill>;
export type McpCreateInput = Partial<McpServer>;
export type AgentCreateInput = Partial<AgentResource>;
export type MarketplaceResourceListSort = 'newest' | 'popular' | 'likes';
export interface MarketplaceResourceListParams {
  slug: MarketplaceTypeSlug;
  category?: string;
  search?: string;
  sort?: MarketplaceResourceListSort;
  page?: number;
  pageSize?: number;
}
export type MarketplaceTemplateItem = Pick<
  ImageTemplate | VideoTemplate,
  'id' | 'title' | 'coverImage' | 'category'
>;

export interface AcquiredResourceItem {
  resourceType: 'SKILL' | 'MCP' | 'AGENT';
  resourceId: string;
  resource?: { id?: string; title?: string } | AnyResource;
}

const API_BY_SLUG = {
  'image-templates': imageTemplateApi,
  'video-templates': videoTemplateApi,
  skills: skillApi,
  mcp: mcpApi,
  agents: agentApi,
} as const;

const acquiredResourceItems = (data: unknown): AcquiredResourceItem[] => {
  const items = (data as { items?: unknown[] })?.items ?? [];
  return items as AcquiredResourceItem[];
};

export const marketplaceActions = {
  getHome: async (): Promise<MarketplaceHome> => {
    const res = await marketplaceApi.home();
    return res.data as MarketplaceHome;
  },
  getPlatformStats: async (): Promise<PlatformStats> => {
    const res = await marketplaceApi.platformStats();
    return res.data;
  },
  createImageTemplate: (data: ImageTemplateCreateInput) =>
    imageTemplateApi.create(data),
  createVideoTemplate: (data: VideoTemplateCreateInput) =>
    videoTemplateApi.create(data),
  createSkill: (data: SkillCreateInput) => skillApi.create(data),
  createMcp: (data: McpCreateInput) => mcpApi.create(data),
  createAgent: (data: AgentCreateInput) => agentApi.create(data),
  listAgents: async (params?: { page?: number; pageSize?: number }) => {
    const res = await agentApi.list(params);
    const items = ((res.data as { items?: AgentResource[] })?.items ??
      res.data) as AgentResource[];
    return Array.isArray(items) ? items : [];
  },
  listTemplatesForKind: async (
    kind: AgentKind,
    params?: { page?: number; pageSize?: number },
  ): Promise<MarketplaceTemplateItem[]> => {
    const api =
      kind === 'image'
        ? imageTemplateApi
        : kind === 'video'
          ? videoTemplateApi
          : null;
    if (!api) return [];

    const res = await api.list(params);
    const items = ((res.data as { items?: MarketplaceTemplateItem[] })?.items ??
      res.data) as MarketplaceTemplateItem[];
    return Array.isArray(items) ? items : [];
  },
  listConversationResources: async (conversationId: string) => {
    const res = await conversationResourcesApi.list(conversationId);
    return res.data ?? [];
  },
  getResourceDetail: async (
    slug: MarketplaceTypeSlug,
    id: string,
  ): Promise<AnyResource> => {
    const api = API_BY_SLUG[slug];
    const res = await api.getById(id);
    return res.data as AnyResource;
  },
  listResources: async ({
    slug,
    category,
    search,
    sort = 'newest',
    page = 1,
    pageSize = 20,
  }: MarketplaceResourceListParams): Promise<PaginatedResult<AnyResource>> => {
    const api = API_BY_SLUG[slug];
    const res = await api.list({
      category: category || undefined,
      search: search || undefined,
      sort,
      page,
      pageSize,
    });
    const data = res.data as PaginatedResult<AnyResource>;
    return {
      items: data.items ?? [],
      total: data.total ?? 0,
      page: data.page ?? page,
      pageSize: data.pageSize ?? pageSize,
      hasMore: data.hasMore ?? false,
    };
  },
  attachConversationResource: (
    conversationId: string,
    resourceType: ResourceType,
    resourceId: string,
  ) => conversationResourcesApi.attach(conversationId, resourceType, resourceId),
  detachConversationResource: (
    conversationId: string,
    resourceType: ResourceType,
    resourceId: string,
  ) => conversationResourcesApi.detach(conversationId, resourceType, resourceId),
  acquireResource: async (
    slug: 'skills' | 'mcp' | 'agents',
    resourceId: string,
  ): Promise<{ newBalance: number; resource: AnyResource }> => {
    const res = await acquisitionsApi.acquire(slug, resourceId);
    const payload = res.data as { newBalance: number; resource: AnyResource };
    return { newBalance: payload.newBalance, resource: payload.resource };
  },
  listAcquiredResources: async (params?: { page?: number; pageSize?: number }) => {
    const res = await meApi.resources('acquired', params);
    return acquiredResourceItems(res.data);
  },
  listSwitchableAgents: async () => {
    const [agentResult, acquiredResult] = await Promise.allSettled([
      agentApi.list({ pageSize: 100 }),
      meApi.resources('acquired', { pageSize: 100 }),
    ]);
    const allAgents =
      agentResult.status === 'fulfilled'
        ? (((agentResult.value.data as { items?: AgentResource[] })?.items ??
            agentResult.value.data) as AgentResource[])
        : [];
    const acquiredAgents =
      acquiredResult.status === 'fulfilled'
        ? acquiredResourceItems(acquiredResult.value.data)
            .filter((item) => item.resourceType === 'AGENT' && item.resource)
            .map((item) => item.resource as AgentResource)
        : [];
    const byId = new Map<string, AgentResource>();
    for (const agent of allAgents) {
      if (agent.isSystem) byId.set(agent.id, agent);
    }
    for (const agent of acquiredAgents) {
      byId.set(agent.id, agent);
    }
    return Array.from(byId.values());
  },
};
