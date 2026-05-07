import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PointsSource, ResourceType } from '../prisma/generated';
import { PrismaService } from '../prisma/prisma.service';
import { PointsService } from '../points/points.service';

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

    const resource = await this.fetchResource(type, resourceId);
    if (!resource) throw new NotFoundException('资源不存在');

    const cost = resource.pointsCost ?? 0;

    if (cost > 0) {
      await this.pointsService.deductPoints(
        userId,
        cost,
        PointsSource.TASK,
        undefined,
        `${TASK_TYPE_BY_RESOURCE[type]}: ${resource.title}`,
      );
    }

    const acq = await this.prisma.user_resource_acquisitions.create({
      data: {
        userId,
        resourceType: type,
        resourceId,
        pointsPaid: cost,
      },
    });

    await this.incrementUseCount(type, resourceId);

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

    // 按 type 批量补充资源详情
    const grouped = rows.reduce<Record<ResourceType, string[]>>(
      (acc, r) => {
        const arr = acc[r.resourceType] ?? [];
        arr.push(r.resourceId);
        acc[r.resourceType] = arr;
        return acc;
      },
      {} as Record<ResourceType, string[]>,
    );

    const detailMap = new Map<string, { type: ResourceType; data: unknown }>();
    for (const [t, ids] of Object.entries(grouped)) {
      const items = await this.fetchResourcesByIds(t as ResourceType, ids);
      for (const item of items) {
        detailMap.set(`${t}:${(item as { id: string }).id}`, {
          type: t as ResourceType,
          data: item,
        });
      }
    }

    return rows.map((r) => ({
      ...r,
      resource: detailMap.get(`${r.resourceType}:${r.resourceId}`)?.data,
    }));
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

  // ── helpers ──────────────────────────────────────────────────────────
  private async fetchResource(type: ResourceType, id: string) {
    switch (type) {
      case ResourceType.SKILL:
        return this.prisma.skills.findUnique({ where: { id } });
      case ResourceType.MCP:
        return this.prisma.mcp_servers.findUnique({ where: { id } });
      case ResourceType.AGENT:
        return this.prisma.agents.findUnique({ where: { id } });
      case ResourceType.IMAGE_TEMPLATE:
        return this.prisma.image_templates.findUnique({ where: { id } });
      case ResourceType.VIDEO_TEMPLATE:
        return this.prisma.video_templates.findUnique({ where: { id } });
    }
  }

  private async fetchResourcesByIds(type: ResourceType, ids: string[]) {
    if (ids.length === 0) return [];
    switch (type) {
      case ResourceType.SKILL:
        return this.prisma.skills.findMany({ where: { id: { in: ids } } });
      case ResourceType.MCP:
        return this.prisma.mcp_servers.findMany({
          where: { id: { in: ids } },
        });
      case ResourceType.AGENT:
        return this.prisma.agents.findMany({ where: { id: { in: ids } } });
      case ResourceType.IMAGE_TEMPLATE:
        return this.prisma.image_templates.findMany({
          where: { id: { in: ids } },
        });
      case ResourceType.VIDEO_TEMPLATE:
        return this.prisma.video_templates.findMany({
          where: { id: { in: ids } },
        });
    }
  }

  private async incrementUseCount(type: ResourceType, id: string) {
    switch (type) {
      case ResourceType.SKILL:
        await this.prisma.skills.update({
          where: { id },
          data: { useCount: { increment: 1 } },
        });
        return;
      case ResourceType.MCP:
        await this.prisma.mcp_servers.update({
          where: { id },
          data: { useCount: { increment: 1 } },
        });
        return;
      case ResourceType.AGENT:
        await this.prisma.agents.update({
          where: { id },
          data: { useCount: { increment: 1 } },
        });
        return;
      default:
        return;
    }
  }
}
