export type ResourceType =
  | 'IMAGE_TEMPLATE'
  | 'VIDEO_TEMPLATE'
  | 'SKILL'
  | 'MCP'
  | 'AGENT';

export type MarketplaceTypeSlug =
  | 'image-templates'
  | 'video-templates'
  | 'skills'
  | 'mcp'
  | 'agents';

export interface ResourceCommon {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  coverImage?: string | null;
  tags: string[];
  pointsCost: number;
  status: string;
  authorId: string;
  likeCount: number;
  favoriteCount: number;
  viewCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformStats {
  totalResources: number;
  bySkillCount: number;
  byMcpCount: number;
  byAgentCount: number;
  byImageTemplateCount: number;
  byVideoTemplateCount: number;
  totalAcquisitions: number;
}

export interface UserResourceAcquisition {
  id: string;
  userId: string;
  resourceType: ResourceType;
  resourceId: string;
  pointsPaid: number;
  acquiredAt: string;
  resource?: unknown;
}
