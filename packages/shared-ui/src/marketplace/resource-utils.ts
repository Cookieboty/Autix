import type { MarketplaceTypeSlug, ResourceType } from '@autix/shared-store';

export const MARKETPLACE_TYPES: MarketplaceTypeSlug[] = [
  'skills',
  'mcp',
  'agents',
  'image-templates',
  'video-templates',
];

export const TYPE_LABEL_KEY: Record<MarketplaceTypeSlug, 'skill' | 'mcp' | 'agent' | 'imageTemplate' | 'videoTemplate'> = {
  skills: 'skill',
  mcp: 'mcp',
  agents: 'agent',
  'image-templates': 'imageTemplate',
  'video-templates': 'videoTemplate',
};

export const SLUG_TO_RESOURCE_TYPE: Record<MarketplaceTypeSlug, ResourceType> = {
  skills: 'SKILL',
  mcp: 'MCP',
  agents: 'AGENT',
  'image-templates': 'IMAGE_TEMPLATE',
  'video-templates': 'VIDEO_TEMPLATE',
};

export const RESOURCE_TYPE_TO_SLUG: Record<ResourceType, MarketplaceTypeSlug> = {
  SKILL: 'skills',
  MCP: 'mcp',
  AGENT: 'agents',
  IMAGE_TEMPLATE: 'image-templates',
  VIDEO_TEMPLATE: 'video-templates',
};

export const ACQUIRABLE_SLUGS = new Set<MarketplaceTypeSlug>([
  'skills',
  'mcp',
  'agents',
]);

/**
 * 当前在 marketplace 启用的资源类型。skills/mcp/agents 暂时下线，专注图片与视频模板。
 * 列表页与详情页统一以此判定合法性，避免"列表禁、详情放行"的不一致。
 */
export const MARKETPLACE_ENABLED_SLUGS: MarketplaceTypeSlug[] = [
  'image-templates',
  'video-templates',
];

export function marketplaceSlugForResourceType(
  resourceType: ResourceType,
): MarketplaceTypeSlug {
  return RESOURCE_TYPE_TO_SLUG[resourceType];
}

export function marketplaceSlugForResource(
  resource: { resourceType?: ResourceType },
): MarketplaceTypeSlug {
  return resource.resourceType
    ? marketplaceSlugForResourceType(resource.resourceType)
    : 'image-templates';
}
