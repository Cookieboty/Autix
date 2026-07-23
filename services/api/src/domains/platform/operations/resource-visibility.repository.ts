import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ResourceType } from '../prisma/generated';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 运营位 / 加热的落地目标校验（gallery-design.md §十 / §十一）。
 * 与 featured_slots.assertFeaturedSlot（纯校验 type/id 非空）不同，这里要打一次 DB
 * 才能确认目标真实存在且处于"可展示"状态——只读查询，禁止写。
 *
 * 供 FeaturedSlotsService（createSlot/updateSlot 的 kind=RESOURCE）与
 * BoostService（createBoost）共用，因此放在 operations 目录下独立于两者的
 * repository，避免互相依赖。
 */
@Injectable()
export class ResourceVisibilityRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 校验 resourceType/resourceId 指向的资源存在且可见：
   * - IMAGE_TEMPLATE / VIDEO_TEMPLATE：status 必须是 APPROVED。
   * - GALLERY_POST：status 必须是 PUBLISHED。
   * - SKILL / MCP / AGENT：仅要求存在（当前无审核态门槛）。
   * 缺失 → NotFoundException；存在但状态不满足 → BadRequestException。
   */
  async assertResourceVisible(
    resourceType: ResourceType,
    resourceId: string,
  ): Promise<void> {
    switch (resourceType) {
      case ResourceType.IMAGE_TEMPLATE: {
        const row = await this.prisma.image_templates.findUnique({
          where: { id: resourceId },
          select: { status: true },
        });
        if (!row) throw new NotFoundException('Image template not found');
        if (row.status !== 'APPROVED') {
          throw new BadRequestException('Image template is not approved and cannot be a featured/boost target');
        }
        return;
      }
      case ResourceType.VIDEO_TEMPLATE: {
        const row = await this.prisma.video_templates.findUnique({
          where: { id: resourceId },
          select: { status: true },
        });
        if (!row) throw new NotFoundException('Video template not found');
        if (row.status !== 'APPROVED') {
          throw new BadRequestException('Video template is not approved and cannot be a featured/boost target');
        }
        return;
      }
      case ResourceType.GALLERY_POST: {
        const row = await this.prisma.gallery_posts.findUnique({
          where: { id: resourceId },
          select: { status: true },
        });
        if (!row) throw new NotFoundException('Gallery post not found');
        if (row.status !== 'PUBLISHED') {
          throw new BadRequestException('Gallery post is not published and cannot be a featured/boost target');
        }
        return;
      }
      case ResourceType.SKILL: {
        const row = await this.prisma.skills.findUnique({
          where: { id: resourceId },
          select: { id: true },
        });
        if (!row) throw new NotFoundException('Skill not found');
        return;
      }
      case ResourceType.MCP: {
        const row = await this.prisma.mcp_servers.findUnique({
          where: { id: resourceId },
          select: { id: true },
        });
        if (!row) throw new NotFoundException('MCP service not found');
        return;
      }
      case ResourceType.AGENT: {
        const row = await this.prisma.agents.findUnique({
          where: { id: resourceId },
          select: { id: true },
        });
        if (!row) throw new NotFoundException('Agent not found');
        return;
      }
      default:
        throw new BadRequestException(`Unsupported resource type: ${resourceType}`);
    }
  }
}
