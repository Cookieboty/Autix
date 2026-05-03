export type ResourceType =
  | 'SKILL'
  | 'MCP'
  | 'AGENT'
  | 'IMAGE_TEMPLATE'
  | 'VIDEO_TEMPLATE';

export type MarketplaceTypeSlug =
  | 'skills'
  | 'mcp'
  | 'agents'
  | 'image-templates'
  | 'video-templates';

export const SLUG_TO_TYPE: Record<MarketplaceTypeSlug, ResourceType> = {
  skills: 'SKILL',
  mcp: 'MCP',
  agents: 'AGENT',
  'image-templates': 'IMAGE_TEMPLATE',
  'video-templates': 'VIDEO_TEMPLATE',
};

export const TYPE_TO_SLUG: Record<ResourceType, MarketplaceTypeSlug> = {
  SKILL: 'skills',
  MCP: 'mcp',
  AGENT: 'agents',
  IMAGE_TEMPLATE: 'image-templates',
  VIDEO_TEMPLATE: 'video-templates',
};

export const ACQUIRABLE_SLUGS: MarketplaceTypeSlug[] = [
  'skills',
  'mcp',
  'agents',
];
