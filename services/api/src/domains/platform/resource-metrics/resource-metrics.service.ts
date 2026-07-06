import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, ResourceType } from '../prisma/generated';
import { isMetricResourceType } from '../prisma/resource-type.helpers';
import { ResourceMetricsRepository } from './resource-metrics.repository';
import {
  buildDefaultMetrics,
  type ResourceMetricsSnapshot,
} from './resource-metrics.util';

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

  private assertMetricType(
    type: ResourceType | undefined,
  ): asserts type is ResourceType {
    if (!type || !isMetricResourceType(type)) {
      throw new BadRequestException(`不支持的资源类型: ${type ?? '(空)'}`);
    }
  }
}
