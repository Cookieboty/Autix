import {
  agentApi,
  conversationResourcesApi,
  imageTemplateApi,
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
  type MarketplaceTypeSlug,
  type McpServer,
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
  AnyResource,
  ConversationKind,
  MarketplaceTypeSlug,
  PlatformStats,
  RuntimeReq,
  ResourceType,
  TemplateVariable,
  WorkflowStepDef,
  ConversationResourceLink,
} from '@autix/sdk';

export type ImageTemplateCreateInput = Partial<ImageTemplate>;
export type VideoTemplateCreateInput = Partial<VideoTemplate>;
export type SkillCreateInput = Partial<Skill>;
export type McpCreateInput = Partial<McpServer>;
export type AgentCreateInput = Partial<AgentResource>;
export type MarketplaceTemplateItem = Pick<
  ImageTemplate | VideoTemplate,
  'id' | 'title' | 'coverImage' | 'category'
>;

export interface AcquiredResourceItem {
  resourceType: 'SKILL' | 'MCP' | 'AGENT';
  resourceId: string;
  resource?: { id?: string; title?: string } | AnyResource;
}

const acquiredResourceItems = (data: unknown): AcquiredResourceItem[] => {
  const items = (data as { items?: unknown[] })?.items ?? [];
  return items as AcquiredResourceItem[];
};

export const marketplaceActions = {
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
