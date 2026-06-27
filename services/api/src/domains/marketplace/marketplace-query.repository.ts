import { Injectable } from '@nestjs/common';
import { TemplateStatus } from '../platform/prisma/generated';
import { PrismaService } from '../platform/prisma/prisma.service';

@Injectable()
export class MarketplaceQueryRepository {
  private readonly imageWorkbenchExternalId = 'system:image-workbench';

  constructor(private readonly prisma: PrismaService) {}

  findHomeCategoryRows(take: number) {
    const where = { status: TemplateStatus.APPROVED };
    const templateOrderBy = [
      { isHot: 'desc' as const },
      { useCount: 'desc' as const },
      { createdAt: 'desc' as const },
    ];

    return Promise.all([
      this.prisma.skills.findMany({
        where,
        orderBy: { useCount: 'desc' },
        take,
      }),
      this.prisma.mcp_servers.findMany({
        where,
        orderBy: { useCount: 'desc' },
        take,
      }),
      this.prisma.agents.findMany({
        where,
        orderBy: { useCount: 'desc' },
        take,
      }),
      this.prisma.image_templates.findMany({
        where: this.imageTemplatePublicWhere(where),
        orderBy: templateOrderBy,
        take,
      }),
      this.prisma.video_templates.findMany({
        where,
        orderBy: templateOrderBy,
        take,
      }),
    ]).then(([skills, mcps, agents, imageTemplates, videoTemplates]) => ({
      skills,
      mcps,
      agents,
      imageTemplates,
      videoTemplates,
    }));
  }

  findHotTemplateRows(take: number) {
    const where = { status: TemplateStatus.APPROVED };
    const orderBy = [
      { isHot: 'desc' as const },
      { useCount: 'desc' as const },
      { createdAt: 'desc' as const },
    ];

    return Promise.all([
      this.prisma.image_templates.findMany({
        where: this.imageTemplatePublicWhere(where),
        orderBy,
        take,
      }),
      this.prisma.video_templates.findMany({ where, orderBy, take }),
    ]).then(([imageTemplates, videoTemplates]) => ({
      imageTemplates,
      videoTemplates,
    }));
  }

  findEditorPickRows(take: number) {
    const where = { status: TemplateStatus.APPROVED };
    const orderBy = { likeCount: 'desc' as const };

    return Promise.all([
      this.prisma.skills.findMany({ where, orderBy, take }),
      this.prisma.mcp_servers.findMany({ where, orderBy, take }),
      this.prisma.agents.findMany({ where, orderBy, take }),
      this.prisma.image_templates.findMany({
        where: this.imageTemplatePublicWhere(where),
        orderBy,
        take,
      }),
      this.prisma.video_templates.findMany({ where, orderBy, take }),
    ]).then(([skills, mcps, agents, imageTemplates, videoTemplates]) => ({
      skills,
      mcps,
      agents,
      imageTemplates,
      videoTemplates,
    }));
  }

  findPlatformStatsRows() {
    const where = { status: TemplateStatus.APPROVED };

    return Promise.all([
      this.prisma.skills.count({ where }),
      this.prisma.mcp_servers.count({ where }),
      this.prisma.agents.count({ where }),
      this.prisma.image_templates.count({
        where: this.imageTemplatePublicWhere(where),
      }),
      this.prisma.video_templates.count({ where }),
      this.prisma.user_resource_acquisitions.count(),
    ]).then(
      ([
        skillCount,
        mcpCount,
        agentCount,
        imageTemplateCount,
        videoTemplateCount,
        acquisitionCount,
      ]) => ({
        skillCount,
        mcpCount,
        agentCount,
        imageTemplateCount,
        videoTemplateCount,
        acquisitionCount,
      }),
    );
  }

  findPublishedRows(authorId: string) {
    const where = { authorId };
    const orderBy = { createdAt: 'desc' as const };

    return Promise.all([
      this.prisma.skills.findMany({ where, orderBy }),
      this.prisma.mcp_servers.findMany({ where, orderBy }),
      this.prisma.agents.findMany({ where, orderBy }),
      this.prisma.image_templates.findMany({
        where: this.imageTemplatePublicWhere(where),
        orderBy,
      }),
      this.prisma.video_templates.findMany({ where, orderBy }),
    ]).then(([skills, mcps, agents, imageTemplates, videoTemplates]) => ({
      skills,
      mcps,
      agents,
      imageTemplates,
      videoTemplates,
    }));
  }

  findGenerationRows(userId: string, take: number) {
    return Promise.all([
      this.prisma.image_generations.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take,
        include: {
          template: {
            select: { title: true, coverImage: true, category: true },
          },
        },
      }),
      this.prisma.video_generations.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take,
        include: {
          template: {
            select: { title: true, coverImage: true, category: true },
          },
        },
      }),
    ]).then(([imageGenerations, videoGenerations]) => ({
      imageGenerations,
      videoGenerations,
    }));
  }

  countGenerationRows(userId: string) {
    return Promise.all([
      this.prisma.image_generations.count({ where: { userId } }),
      this.prisma.video_generations.count({ where: { userId } }),
    ]).then(([imageTotal, videoTotal]) => ({ imageTotal, videoTotal }));
  }

  private imageTemplatePublicWhere(extra: Record<string, unknown> = {}) {
    return {
      ...extra,
      OR: [
        { externalId: null },
        { externalId: { not: this.imageWorkbenchExternalId } },
      ],
    };
  }
}
