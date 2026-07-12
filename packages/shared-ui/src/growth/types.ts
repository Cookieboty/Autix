import type { ResolvedFeaturedSlot } from '@autix/domain';
import type { PublicGrowthHome as BasePublicGrowthHome } from '@autix/shared-store';

export type {
  PublicCollectionDetail,
  PublicCollectionKind,
  PublicCreatorDetail,
  PublicCreatorProfile,
  PublicGrowthAuthor,
  PublicGrowthCollection,
  PublicGrowthFeature,
  PublicGrowthHomeSection,
  PublicGrowthMediaItem,
  PublicGrowthPage,
} from '@autix/shared-store';

/** 首页 payload：在原有 API 形状之外，附加服务端聚合出的 hero 运营位（resolveSlot 结果）。 */
export type PublicGrowthHome = BasePublicGrowthHome & {
  heroSlots?: ResolvedFeaturedSlot[];
};

/** `/api/featured-slots` 已 resolveSlot 的展示单元；与 `@autix/domain` 的 `ResolvedFeaturedSlot` 同构。 */
export type FeaturedSlot = ResolvedFeaturedSlot;

/**
 * 首页本地数据形状：与 public-growth 域解耦，只承载 featured-slots 聚合结果。
 * Gallery 区块由 `HomeGallerySection` 自行请求 `/gallery/feed`，不进入此类型。
 */
export type PublicHomeData = {
  heroSlots: FeaturedSlot[];
};
