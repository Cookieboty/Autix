import { ResourceType } from './generated';

/**
 * Gallery 作品：只进入统一指标 / 互动体系（resource_metrics、resource_likes…），
 * **不属于** marketplace 的获取（acquisition）/ 激活（activation）链路。
 * 新增 ResourceType 时，用下面的判定把"能进哪条链路"写死，避免被穷尽 switch/Record 静默吃掉。
 */
export function isGalleryResourceType(type: ResourceType): boolean {
  return type === ResourceType.GALLERY_POST;
}

/** 参与统一指标（PV/UV/点赞/收藏/引用/热度）的资源类型——当前为全部 ResourceType。 */
export function isMetricResourceType(type: ResourceType): boolean {
  return Object.values(ResourceType).includes(type);
}
