import { AgentKind, ResourceType } from '../../platform/prisma/generated';

export type ConversationResourceLink = {
  resourceType: ResourceType;
  resourceId: string;
};

export type ResourceDetail = {
  id: string;
  [key: string]: unknown;
};

export type PromptResourceIds = {
  skillIds: string[];
  agentIds: string[];
  mcpIds: string[];
  imageTemplateIds: string[];
  videoTemplateIds: string[];
};

export type PromptSkillResource = {
  title: string;
  instructions: string;
};

export type PromptAgentResource = {
  title: string;
  systemPrompt: string;
};

export type PromptMcpResource = {
  id: string;
  serverName: string;
  transport: string;
};

export type PromptTemplateResource = {
  title: string;
  prompt: string;
  variables?: unknown;
  modelHint?: string | null;
};

export type PromptResources = {
  skills: PromptSkillResource[];
  agents: PromptAgentResource[];
  mcps: PromptMcpResource[];
  imageTemplates: PromptTemplateResource[];
  videoTemplates: PromptTemplateResource[];
};

export type MentionResourceType =
  | typeof ResourceType.SKILL
  | typeof ResourceType.AGENT
  | typeof ResourceType.MCP;

export type MentionRef = {
  type: MentionResourceType;
  id: string;
};

export type MentionSkillResource = {
  title: string;
  instructions: string;
};

export type MentionAgentResource = {
  title: string;
  systemPrompt: string;
};

export type MentionMcpResource = {
  title: string;
  serverName: string;
  transport: string;
};

const ACTIVATABLE_TYPES = new Set<ResourceType>([
  ResourceType.SKILL,
  ResourceType.MCP,
  ResourceType.AGENT,
  ResourceType.IMAGE_TEMPLATE,
  ResourceType.VIDEO_TEMPLATE,
]);

const ACQUISITION_REQUIRED_TYPES = new Set<ResourceType>([
  ResourceType.SKILL,
  ResourceType.MCP,
  ResourceType.AGENT,
]);

const DETAIL_RESOURCE_TYPES = new Set<ResourceType>([
  ResourceType.SKILL,
  ResourceType.MCP,
  ResourceType.AGENT,
  ResourceType.IMAGE_TEMPLATE,
  ResourceType.VIDEO_TEMPLATE,
]);

export function isActivatableResourceType(type: ResourceType): boolean {
  return ACTIVATABLE_TYPES.has(type);
}

export function requiresResourceAcquisition(type: ResourceType): boolean {
  return ACQUISITION_REQUIRED_TYPES.has(type);
}

export function isTemplateResourceType(type: ResourceType): boolean {
  return (
    type === ResourceType.IMAGE_TEMPLATE ||
    type === ResourceType.VIDEO_TEMPLATE
  );
}

export function isDetailResourceType(type: ResourceType): boolean {
  return DETAIL_RESOURCE_TYPES.has(type);
}

export function templateConflictKey(type: ResourceType): string {
  return type === ResourceType.IMAGE_TEMPLATE
    ? 'creation.conversation.image_template_already_linked'
    : 'creation.conversation.video_template_already_linked';
}

export function conversationKindForAttachedTemplate(
  type: ResourceType,
): AgentKind | undefined {
  if (type === ResourceType.IMAGE_TEMPLATE) return AgentKind.image;
  if (type === ResourceType.VIDEO_TEMPLATE) return AgentKind.video;
  return undefined;
}

export function conversationKindFromTemplatePresence(input: {
  hasVideoTemplate: boolean;
  hasImageTemplate: boolean;
}): AgentKind {
  if (input.hasVideoTemplate) return AgentKind.video;
  return input.hasImageTemplate ? AgentKind.image : AgentKind.chat;
}

export function hasStartedAgentKindConflict(input: {
  messageCount: number;
  currentAgent: { kind: AgentKind } | null;
  newAgent: { kind: AgentKind } | null;
}): boolean {
  return (
    input.messageCount > 0 &&
    !!input.currentAgent &&
    !!input.newAgent &&
    input.currentAgent.kind !== input.newAgent.kind
  );
}

export function getPromptResourceIds(
  links: ConversationResourceLink[],
): PromptResourceIds {
  const ids: PromptResourceIds = {
    skillIds: [],
    agentIds: [],
    mcpIds: [],
    imageTemplateIds: [],
    videoTemplateIds: [],
  };

  for (const link of links) {
    switch (link.resourceType) {
      case ResourceType.SKILL:
        ids.skillIds.push(link.resourceId);
        break;
      case ResourceType.AGENT:
        ids.agentIds.push(link.resourceId);
        break;
      case ResourceType.MCP:
        ids.mcpIds.push(link.resourceId);
        break;
      case ResourceType.IMAGE_TEMPLATE:
        ids.imageTemplateIds.push(link.resourceId);
        break;
      case ResourceType.VIDEO_TEMPLATE:
        ids.videoTemplateIds.push(link.resourceId);
        break;
      default:
        break;
    }
  }

  return ids;
}

export function buildResourcePromptPayload(resources: PromptResources): {
  prompt: string;
  mcpRefs: PromptMcpResource[];
} {
  const sections: string[] = [];
  for (const skill of resources.skills) {
    sections.push(`## Skill: ${skill.title}\n${skill.instructions}`);
  }
  for (const agent of resources.agents) {
    sections.push(`## Agent: ${agent.title}\n${agent.systemPrompt}`);
  }
  for (const template of resources.imageTemplates) {
    sections.push(formatTemplatePromptSection('Image', template));
  }
  for (const template of resources.videoTemplates) {
    sections.push(formatTemplatePromptSection('Video', template));
  }

  const prompt =
    sections.length > 0
      ? `### Conversation active resources (follow the instructions below)\n\n${sections.join('\n\n')}`
      : '';

  return { prompt, mcpRefs: resources.mcps };
}

export function parseMentionRefs(message: string): MentionRef[] {
  const matches = [...message.matchAll(/@(skill|agent|mcp):([a-z0-9_-]+)/gi)];

  return matches.map((match) => ({
    type: mentionTypeFromToken(match[1]),
    id: match[2],
  }));
}

export function formatMentionResourceSection(
  type: MentionRef['type'],
  resource:
    | MentionSkillResource
    | MentionAgentResource
    | MentionMcpResource
    | null,
): string | undefined {
  if (!resource) return undefined;

  if (type === ResourceType.SKILL && 'instructions' in resource) {
    return `## @Skill: ${resource.title}\n${resource.instructions}`;
  }

  if (type === ResourceType.AGENT && 'systemPrompt' in resource) {
    return `## @Agent: ${resource.title}\n${resource.systemPrompt}`;
  }

  if (type === ResourceType.MCP && 'serverName' in resource) {
    return `## @MCP: ${resource.title} (${resource.serverName}, ${resource.transport})`;
  }

  return undefined;
}

export function buildMentionPrompt(sections: string[]): string {
  return sections.length > 0
    ? `### Resources referenced by this message (effective only for this turn)\n\n${sections.join('\n\n')}`
    : '';
}

export function groupResourceIdsByType(
  links: ConversationResourceLink[],
): Partial<Record<ResourceType, string[]>> {
  return links.reduce<Partial<Record<ResourceType, string[]>>>((acc, link) => {
    const ids = acc[link.resourceType] ?? [];
    ids.push(link.resourceId);
    acc[link.resourceType] = ids;
    return acc;
  }, {});
}

export function resourceDetailKey(
  resourceType: ResourceType,
  resourceId: string,
): string {
  return `${resourceType}:${resourceId}`;
}

export function addResourceDetailsToMap(
  detailMap: Map<string, unknown>,
  resourceType: ResourceType,
  items: ResourceDetail[],
): void {
  for (const item of items) {
    detailMap.set(resourceDetailKey(resourceType, item.id), item);
  }
}

export function attachResourceDetails<
  TLink extends ConversationResourceLink,
>(
  links: TLink[],
  detailMap: Map<string, unknown>,
): Array<TLink & { resource: unknown }> {
  return links.map((link) => ({
    ...link,
    resource: detailMap.get(
      resourceDetailKey(link.resourceType, link.resourceId),
    ),
  }));
}

function formatTemplatePromptSection(
  label: 'Image' | 'Video',
  template: PromptTemplateResource,
): string {
  return [
    `## ${label} Template: ${template.title}`,
    `Prompt Template:\n${template.prompt}`,
    `Variables:\n${JSON.stringify(template.variables ?? [], null, 2)}`,
    template.modelHint ? `Preferred ${label} Model: ${template.modelHint}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function mentionTypeFromToken(
  token: string,
): MentionResourceType {
  const lower = token.toLowerCase();
  if (lower === 'skill') return ResourceType.SKILL;
  return lower === 'agent' ? ResourceType.AGENT : ResourceType.MCP;
}
