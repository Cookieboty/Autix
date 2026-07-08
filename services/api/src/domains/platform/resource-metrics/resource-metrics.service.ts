import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, ResourceType } from '../prisma/generated';
import {
  isGalleryResourceType,
  isMetricResourceType,
} from '../prisma/resource-type.helpers';
import { ResourceMetricsRepository } from './resource-metrics.repository';
import {
  buildDefaultMetrics,
  type ResourceMetricsSnapshot,
} from './resource-metrics.util';
import { computeHotScore } from './hot-score';
import { HOT_WEIGHTS } from '@autix/domain';

/**
 * 统一指标 / 互动体系（gallery-design.md §9）：读指标 + 点赞/收藏/分享/引用计数。
 * 热度重算（hotScore）不在本服务范围内，见同目录 hot-score.ts。
 */
@Injectable()
export class ResourceMetricsService {
  constructor(private readonly repo: ResourceMetricsRepository) {}

  /** 读取指标；无行时返回全零默认值，读操作本身不建行。 */
  async getMetrics(
    type: ResourceType,
    resourceId: string,
  ): Promise<ResourceMetricsSnapshot> {
    this.assertMetricType(type);
    const row = await this.repo.findMetrics(type, resourceId);
    return row ?? buildDefaultMetrics(type, resourceId);
  }

  /** 批量读取指标，返回 resourceId → 指标 的 Map；无行的 id 不入 Map，由调用方补默认值。 */
  async getMetricsMap(
    type: ResourceType,
    resourceIds: string[],
  ): Promise<Map<string, ResourceMetricsSnapshot>> {
    this.assertMetricType(type);
    const rows = await this.repo.findMetricsByIds(type, resourceIds);
    return new Map<string, ResourceMetricsSnapshot>(
      rows.map((row) => [row.resourceId, row] as const),
    );
  }

  async like(userId: string, type: ResourceType, resourceId: string) {
    this.assertMetricType(type);
    const row = await this.repo.like(userId, type, resourceId);
    return row ?? buildDefaultMetrics(type, resourceId);
  }

  async unlike(userId: string, type: ResourceType, resourceId: string) {
    this.assertMetricType(type);
    const row = await this.repo.unlike(userId, type, resourceId);
    return row ?? buildDefaultMetrics(type, resourceId);
  }

  async favorite(userId: string, type: ResourceType, resourceId: string) {
    this.assertMetricType(type);
    const row = await this.repo.favorite(userId, type, resourceId);
    return row ?? buildDefaultMetrics(type, resourceId);
  }

  async unfavorite(userId: string, type: ResourceType, resourceId: string) {
    this.assertMetricType(type);
    const row = await this.repo.unfavorite(userId, type, resourceId);
    return row ?? buildDefaultMetrics(type, resourceId);
  }

  async share(type: ResourceType, resourceId: string) {
    this.assertMetricType(type);
    const row = await this.repo.share(type, resourceId);
    return row ?? buildDefaultMetrics(type, resourceId);
  }

  /**
   * 供其它域调用（如技能/工作流被引用时）：记录一次引用事件并 INCR referenceCount。
   * 导出为公共方法，供后续接入方直接注入 ResourceMetricsService 调用。
   */
  async recordReference(
    type: ResourceType,
    resourceId: string,
    refType: string,
    refUserId?: string,
    refPayload?: Prisma.InputJsonValue,
  ) {
    this.assertMetricType(type);
    const row = await this.repo.recordReference(
      type,
      resourceId,
      refType,
      refUserId,
      refPayload,
    );
    return row ?? buildDefaultMetrics(type, resourceId);
  }

  /**
   * 幂等的热度重算（gallery-design.md §9.1）：仅重算近 `activeSinceDays` 天内有活动的资源，
   * 对每行用 `computeHotScore` 重新算出 hotScore 并整体 SET（含刷新 hotScoreVersion），
   * 同一批输入重复执行结果一致。供 cron 调用（见 resource-metrics.cron.ts）。
   */
  async recomputeHotScores(
    activeSinceDays = 30,
    now: Date = new Date(),
  ): Promise<{ updated: number }> {
    const since = new Date(now.getTime() - activeSinceDays * 24 * 60 * 60 * 1000);
    const rows = await this.repo.findActiveSince(since);
    const hotScoreVersion = String(now.getTime());

    for (const row of rows) {
      const halfLifeHours = isGalleryResourceType(row.resourceType)
        ? HOT_WEIGHTS.halfLifeHours.gallery
        : HOT_WEIGHTS.halfLifeHours.template;
      const ageHours = (now.getTime() - row.firstSeenAt.getTime()) / 3_600_000;

      const hotScore = computeHotScore({
        uvCount: row.uvCount,
        pvCount: row.pvCount,
        likeCount: row.likeCount,
        favoriteCount: row.favoriteCount,
        commentCount: row.commentCount,
        shareCount: row.shareCount,
        referenceCount: row.referenceCount,
        citationCount: row.citationCount,
        ageHours,
        halfLifeHours,
        boostScore: row.boostScore,
        // P2：这里恒传 0 是对的——row.boostScore 已经是 boost.repository.ts#sumActiveByResource
        // 用 decayedBoostSum 按各条加热自身 age 衰减求和后的结果（aggregateActiveBoosts 每
        // ~10min SET 一次），不需要在这里再按"加热年龄"衰减第二遍。
        boostAgeHours: 0,
      });

      await this.repo.setHotScore(
        row.resourceType,
        row.resourceId,
        hotScore,
        hotScoreVersion,
      );
    }

    return { updated: rows.length };
  }

  private assertMetricType(
    type: ResourceType | undefined,
  ): asserts type is ResourceType {
    if (!type || !isMetricResourceType(type)) {
      throw new BadRequestException(`不支持的资源类型: ${type ?? '(空)'}`);
    }
  }
}
