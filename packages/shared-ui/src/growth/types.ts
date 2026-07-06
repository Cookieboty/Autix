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
