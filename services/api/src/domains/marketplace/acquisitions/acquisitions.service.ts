import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PointsSource, ResourceType } from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { PointsService } from '../../billing/points/points.service';
import { MarketplaceResourceRepository } from '../marketplace-resource.repository';

const ACQUIRABLE_TYPES = new Set<ResourceType>([
  ResourceType.SKILL,
  ResourceType.MCP,
  ResourceType.AGENT,
]);

const TASK_TYPE_BY_RESOURCE: Record<ResourceType, string> = {
  SKILL: 'skill_acquisition',
  MCP: 'mcp_acquisition',
  AGENT: 'agent_acquisition',
  IMAGE_TEMPLATE: 'image_generation',
  VIDEO_TEMPLATE: 'video_generation',
};

@Injectable()
export class AcquisitionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pointsService: PointsService,
    private readonly resources: MarketplaceResourceRepository,
  ) {}

  /**
   * 一次性获取(Skills/MCP/Agents):扣分 → 写 acquisitions → 增 useCount
   * - 已获取 → 抛 ConflictException
   * - 余额不足 → deductPoints 抛 BadRequestException
   */
  async acquire(userId: string, type: ResourceType, resourceId: string) {
    if (!ACQUIRABLE_TYPES.has(type)) {
      throw new BadRequestException(
        `资源类型 ${type} 不支持一次性获取(仅 SKILL/MCP/AGENT)`,
      );
    }

    const existing = await this.prisma.user_resource_acquisitions.findUnique({
      where: {
        userId_resourceType_resourceId: {
          userId,
          resourceType: type,
          resourceId,
        },
      },
    });
    if (existing) throw new ConflictException('已获取过该资源');

    const resource = await this.resources.findOne(type, resourceId);
    if (!resource) throw new NotFoundException('资源不存在');

    const cost = resource.pointsCost ?? 0;

    // 扣分与写 acquisition 必须同生共死：任一失败整体回滚，杜绝"扣了分但没记录"。
    const acq = await this.prisma.$transaction(async (tx) => {
      if (cost > 0) {
        await this.pointsService.deductWithinTx(
          tx,
          userId,
          cost,
          PointsSource.TASK,
          resourceId,
          `${TASK_TYPE_BY_RESOURCE[type]}: ${resource.title}`,
          TASK_TYPE_BY_RESOURCE[type],
        );
      }
      return tx.user_resource_acquisitions.create({
        data: {
          userId,
          resourceType: type,
          resourceId,
          pointsPaid: cost,
        },
      });
    });

    await this.resources.incrementUseCount(type, resourceId);

    const balance = await this.prisma.user_points.findUnique({
      where: { userId },
    });

    return {
      acquisition: acq,
      newBalance: balance?.balance ?? 0,
      resource,
    };
  }

  async listAcquired(userId: string, type?: ResourceType) {
    const where: { userId: string; resourceType?: ResourceType } = { userId };
    if (type) where.resourceType = type;
    const rows = await this.prisma.user_resource_acquisitions.findMany({
      where,
      orderBy: { acquiredAt: 'desc' },
    });

    return this.resources.attachResources(rows);
  }

  async hasAcquired(userId: string, type: ResourceType, resourceId: string) {
    const row = await this.prisma.user_resource_acquisitions.findUnique({
      where: {
        userId_resourceType_resourceId: {
          userId,
          resourceType: type,
          resourceId,
        },
      },
    });
    return !!row;
  }

}
