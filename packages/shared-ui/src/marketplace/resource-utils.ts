import type { MarketplaceTypeSlug, ResourceType } from '@autix/shared-lib';

export const MARKETPLACE_TYPES: MarketplaceTypeSlug[] = [
  'skills',
  'mcp',
  'agents',
  'image-templates',
  'video-templates',
];

export const TYPE_LABEL: Record<MarketplaceTypeSlug, string> = {
  skills: 'Skill',
  mcp: 'MCP',
  agents: 'Agent',
  'image-templates': '图片',
  'video-templates': '视频',
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
