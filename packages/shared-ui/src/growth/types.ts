import type { ResolvedFeaturedSlot } from '@autix/domain';

export type {
  PublicGrowthCollection,
  PublicGrowthFeature,
  PublicGrowthMediaItem,
  PublicGrowthPage,
} from '@autix/shared-store';

/** `/api/featured-slots` 已 resolveSlot 的展示单元；与 `@autix/domain` 的 `ResolvedFeaturedSlot` 同构。 */
export type FeaturedSlot = ResolvedFeaturedSlot;

/**
 * 首页本地数据形状：与 public-growth 域解耦，只承载 featured-slots 聚合结果。
 * Gallery 区块由 `HomeGallerySection` 自行请求 `/gallery/feed`，不进入此类型。
 */
export type PublicHomeData = {
  heroSlots: FeaturedSlot[];
};
