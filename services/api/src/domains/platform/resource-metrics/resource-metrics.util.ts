import { ResourceType } from '../prisma/generated';

/**
 * resource_metrics 的对外展示形状（与 Prisma 生成的 model 字段一一对应）。
 * 单独声明是为了让"无行时的默认零值"可以脱离 Prisma 类型被纯函数构造与测试。
 */
export interface ResourceMetricsSnapshot {
  resourceType: ResourceType;
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
  hotScoreVersion: string | null;
  boostScore: number;
  boostExpiresAt: Date | null;
  firstSeenAt: Date;
  lastActivityAt: Date;
  updatedAt: Date;
}

/**
 * 读取指标时，若 resource_metrics 尚无该资源的行，返回全零默认值——
 * 读操作不建行，避免"只看了一眼"就在表里留痕。
 */
export function buildDefaultMetrics(
  resourceType: ResourceType,
  resourceId: string,
  now: Date = new Date(),
): ResourceMetricsSnapshot {
  return {
    resourceType,
    resourceId,
    pvCount: 0,
    uvCount: 0,
    viewCount: 0,
    likeCount: 0,
    favoriteCount: 0,
    commentCount: 0,
    shareCount: 0,
    referenceCount: 0,
    citationCount: 0,
    hotScore: 0,
    hotScoreVersion: null,
    boostScore: 0,
    boostExpiresAt: null,
    firstSeenAt: now,
    lastActivityAt: now,
    updatedAt: now,
  };
}

/** 计数器递减并夹紧到 0：防止取消点赞/收藏等操作在并发或数据不一致时把计数器打成负数。 */
export function clampDecrement(current: number, by = 1): number {
  return Math.max(current - by, 0);
}
