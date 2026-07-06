import type { GalleryStatus, MetricResourceType } from './types';

/**
 * 固定运营位标识（placement）。位置永久存在——只新增，不删除。
 * 首页 hero 即 `home_hero`。
 */
export const FEATURED_PLACEMENTS = {
  HOME_HERO: 'home_hero',
} as const;

export type FeaturedPlacement =
  (typeof FEATURED_PLACEMENTS)[keyof typeof FEATURED_PLACEMENTS];

/**
 * 热度权重默认基线（见 gallery-design.md §9.1）。
 * 后端 hot-score 以此为默认，可按 resourceType 覆盖半衰期等。
 */
export const HOT_WEIGHTS = {
  w_uv: 3.0,
  w_pv: 0.3,
  w_like: 5.0,
  w_favorite: 8.0,
  w_comment: 6.0,
  w_share: 10.0,
  w_reference: 20.0,
  w_citation: 2.0,
  halfLifeHours: { gallery: 48, template: 168 },
  boostHalfLifeHours: 24,
} as const;

/** 全部广场状态（用于校验 / 枚举遍历）。 */
export const GALLERY_STATUSES: readonly GalleryStatus[] = [
  'DRAFT',
  'PENDING',
  'PUBLISHED',
  'REJECTED',
  'HIDDEN',
  'REMOVED',
] as const;

/** 参与统一指标的资源类型全集。 */
export const METRIC_RESOURCE_TYPES: readonly MetricResourceType[] = [
  'SKILL',
  'MCP',
  'AGENT',
  'IMAGE_TEMPLATE',
  'VIDEO_TEMPLATE',
  'GALLERY_POST',
] as const;
