import { Injectable } from '@nestjs/common';
import { Prisma, ResourceType } from '../platform/prisma/generated';
import { PrismaService } from '../platform/prisma/prisma.service';

export interface MarketplaceResourceCrudDelegate {
  findMany: (args?: unknown) => Promise<unknown[]>;
  findUnique: (args: { where: { id: string } }) => Promise<unknown>;
  create: (args: { data: unknown }) => Promise<unknown>;
  update: (args: { where: { id: string }; data: unknown }) => Promise<unknown>;
  delete: (args: { where: { id: string } }) => Promise<unknown>;
  count: (args?: unknown) => Promise<number>;
}

@Injectable()
export class MarketplaceResourceCrudRepository {
  constructor(private readonly prisma: PrismaService) {}

  delegateFor(resourceType: ResourceType): MarketplaceResourceCrudDelegate {
    switch (resourceType) {
      case ResourceType.SKILL:
        return this.prisma.skills as unknown as MarketplaceResourceCrudDelegate;
      case ResourceType.MCP:
        return this.prisma
          .mcp_servers as unknown as MarketplaceResourceCrudDelegate;
      case ResourceType.AGENT:
        return this.prisma.agents as unknown as MarketplaceResourceCrudDelegate;
      case ResourceType.IMAGE_TEMPLATE:
        return this.prisma
          .image_templates as unknown as MarketplaceResourceCrudDelegate;
      case ResourceType.VIDEO_TEMPLATE:
        return this.prisma
          .video_templates as unknown as MarketplaceResourceCrudDelegate;
      default:
        // marketplace CRUD 只服务 marketplace 资源；GALLERY_POST 等不应到达此处。
        throw new Error(`marketplace delegate 不支持资源类型: ${resourceType}`);
    }
  }

  createSkill(data: Prisma.skillsUncheckedCreateInput) {
    return this.prisma.skills.create({ data });
  }

  updateSkill(id: string, data: Prisma.skillsUncheckedUpdateInput) {
    return this.prisma.skills.update({ where: { id }, data });
  }

  createMcp(data: Prisma.mcp_serversUncheckedCreateInput) {
    return this.prisma.mcp_servers.create({ data });
  }

  updateMcp(id: string, data: Prisma.mcp_serversUncheckedUpdateInput) {
    return this.prisma.mcp_servers.update({ where: { id }, data });
  }

  createAgent(data: Prisma.agentsUncheckedCreateInput) {
    return this.prisma.agents.create({ data });
  }

  updateAgent(id: string, data: Prisma.agentsUncheckedUpdateInput) {
    return this.prisma.agents.update({ where: { id }, data });
  }

  createImageTemplate(data: Prisma.image_templatesUncheckedCreateInput) {
    return this.prisma.image_templates.create({ data });
  }

  updateImageTemplate(
    id: string,
    data: Prisma.image_templatesUncheckedUpdateInput,
  ) {
    return this.prisma.image_templates.update({ where: { id }, data });
  }

  createVideoTemplate(data: Prisma.video_templatesUncheckedCreateInput) {
    return this.prisma.video_templates.create({ data });
  }

  updateVideoTemplate(
    id: string,
    data: Prisma.video_templatesUncheckedUpdateInput,
  ) {
    return this.prisma.video_templates.update({ where: { id }, data });
  }
}
