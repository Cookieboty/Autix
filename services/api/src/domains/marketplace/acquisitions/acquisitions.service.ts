import { HttpStatus, Injectable } from '@nestjs/common';
import { PointsSource, ResourceType } from '../../platform/prisma/generated';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';
import { PointsService } from '../../billing/points/points.service';
import { MarketplaceAcquisitionRepository } from '../marketplace-acquisition.repository';
import { MarketplaceResourceRepository } from '../marketplace-resource.repository';

const ACQUIRABLE_TYPES = new Set<ResourceType>([
  ResourceType.SKILL,
  ResourceType.MCP,
  ResourceType.AGENT,
]);

// 非获取类资源（如 GALLERY_POST）不进此映射：用 Partial 避免每加一种 ResourceType 都要改穷尽映射。
const TASK_TYPE_BY_RESOURCE: Partial<Record<ResourceType, string>> = {
  SKILL: 'skill_acquisition',
  MCP: 'mcp_acquisition',
  AGENT: 'agent_acquisition',
  IMAGE_TEMPLATE: 'image_generation',
  VIDEO_TEMPLATE: 'video_generation',
};

@Injectable()
export class AcquisitionsService {
  constructor(
    private readonly acquisitions: MarketplaceAcquisitionRepository,
    private readonly pointsService: PointsService,
    private readonly resources: MarketplaceResourceRepository,
  ) { }

  /**
   * 一次性获取(Skills/MCP/Agents):扣分 → 写 acquisitions → 增 useCount
   * - 已获取 → 抛 ConflictException
   * - 余额不足 → deductPoints 抛 BadRequestException
   */
  async acquire(userId: string, type: ResourceType, resourceId: string) {
    if (!ACQUIRABLE_TYPES.has(type)) {
      throw new I18nHttpException(
        HttpStatus.BAD_REQUEST,
        'acquisition.type_unsupported',
        { type },
      );
    }

    const existing = await this.acquisitions.findAcquisition(
      userId,
      type,
      resourceId,
    );
    if (existing) {
      throw new I18nHttpException(
        HttpStatus.CONFLICT,
        'acquisition.already_owned',
      );
    }

    const resource = await this.resources.findOne(type, resourceId);
    if (!resource) {
      throw new I18nHttpException(
        HttpStatus.NOT_FOUND,
        'acquisition.resource_not_found',
      );
    }

    const cost = resource.pointsCost ?? 0;
    // ACQUIRABLE_TYPES 已保证 type 命中映射；兜底仅为 Partial 的类型安全。
    const taskType =
      TASK_TYPE_BY_RESOURCE[type] ?? `${type.toLowerCase()}_acquisition`;

    // 扣分与写 acquisition 必须同生共死：任一失败整体回滚，杜绝"扣了分但没记录"。
    const acq = await this.acquisitions.createAcquisitionInTransaction(
      {
        userId,
        resourceType: type,
        resourceId,
        pointsPaid: cost,
      },
      cost > 0
        ? (tx) =>
          this.pointsService.deductWithinTx(
            tx,
            userId,
            cost,
            PointsSource.TASK,
            resourceId,
            `${taskType}: ${resource.title}`,
            taskType,
          ).then(() => undefined)
        : undefined,
    );

    await this.resources.incrementUseCount(type, resourceId);

    const balance = await this.acquisitions.findBalance(userId);

    return {
      acquisition: acq,
      newBalance: balance?.balance ?? 0,
      resource,
    };
  }

  async listAcquired(userId: string, type?: ResourceType) {
    const rows = await this.acquisitions.listAcquisitions(userId, type);

    return this.resources.attachResources(rows);
  }

  async listAcquiredPaged(
    userId: string,
    skip: number,
    take: number,
    type?: ResourceType,
  ) {
    const { rows, total } = await this.acquisitions.listAcquisitionsPaged(
      userId,
      skip,
      take,
      type,
    );
    const items = await this.resources.attachResources(rows);
    return { items, total };
  }

  async hasAcquired(userId: string, type: ResourceType, resourceId: string) {
    const row = await this.acquisitions.findAcquisition(
      userId,
      type,
      resourceId,
    );
    return !!row;
  }

}
