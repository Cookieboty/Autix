// Gallery 领域类型。domain 是依赖叶子：不 import @autix/database，
// 枚举以字符串字面量联合表达，与 Prisma enum 保持同名对齐。

export type GalleryKind = 'IMAGE' | 'VIDEO';

export type GalleryStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'HIDDEN'
  | 'REMOVED';

export type GallerySource =
  | 'USER_UPLOAD'
  | 'FROM_GENERATION'
  | 'FROM_TEMPLATE'
  | 'ADMIN_CURATED';

export type FeaturedSlotKind = 'RESOURCE' | 'CUSTOM';

export type BoostReason = 'MANUAL' | 'CAMPAIGN' | 'EDITORIAL_PICK' | 'CORRECTION';

/**
 * 参与统一指标 / 运营位的资源类型（与后端 Prisma `ResourceType` 对齐）。
 * 前端 metrics / featured slot 用这个，而非 marketplace 的 slug 型 ResourceType。
 */
export type MetricResourceType =
  | 'SKILL'
  | 'MCP'
  | 'AGENT'
  | 'IMAGE_TEMPLATE'
  | 'VIDEO_TEMPLATE'
  | 'GALLERY_POST';

export interface GalleryAuthorSnapshot {
  displayName: string;
  avatarUrl?: string;
  at: string;
}

export interface GalleryPost {
  id: string;
  kind: GalleryKind;
  title: string | null;
  description: string | null;
  category: string;
  tags: string[];
  coverImage: string | null;
  mediaUrls: string[];
  aspectRatio: string | null;
  durationSec: number | null;
  prompt: string | null;
  model: string | null;
  width: number | null;
  height: number | null;
  sourceType: GallerySource;
  imageTemplateId: string | null;
  videoTemplateId: string | null;
  imageGenerationId: string | null;
  videoGenerationId: string | null;
  status: GalleryStatus;
  isFeatured: boolean;
  isPinned: boolean;
  authorId: string | null;
  authorSnapshot: GalleryAuthorSnapshot | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface ResourceMetrics {
  resourceType: MetricResourceType;
  resourceId: string;
  pvCount: number;
  uvCount: number;
  viewCount: number;
  likeCount: number;
  favoriteCount: number;
  commentCount: number;
  shareCount: number;
  referenceCount: number;
  citationCount: number;
  hotScore: number;
  boostScore: number;
}

export interface GalleryFeedItem {
  post: GalleryPost;
  metrics: Pick<
    ResourceMetrics,
    'pvCount' | 'uvCount' | 'likeCount' | 'favoriteCount' | 'viewCount' | 'referenceCount'
  >;
}

export interface FeaturedSlot {
  id: string;
  placement: string;
  kind: FeaturedSlotKind;
  resourceType: MetricResourceType | null;
  resourceId: string | null;
  overrideTitle: string | null;
  overrideDescription: string | null;
  overrideCoverImage: string | null;
  overrideCoverVideo: string | null;
  overrideCtaText: string | null;
  overrideCtaHref: string | null;
  position: number;
  isEnabled: boolean;
  startsAt: string | null;
  endsAt: string | null;
}

/** resolveSlot 输出：override 与来源资源合并后的展示单元（前端直接渲染）。 */
export interface ResolvedFeaturedSlot {
  id: string;
  kind: FeaturedSlotKind;
  title: string | null;
  description: string | null;
  coverImage: string | null;
  coverVideo: string | null;
  ctaText: string | null;
  ctaHref: string | null;
}

export interface ResourceBoost {
  id: string;
  resourceType: MetricResourceType;
  resourceId: string;
  boostScore: number;
  reason: BoostReason;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}
