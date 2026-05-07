import { Injectable } from '@nestjs/common';
import { ResourceType, TemplateStatus } from '../prisma/generated';
import { PrismaService } from '../prisma/prisma.service';
import { AcquisitionsService } from '../acquisitions/acquisitions.service';

interface Pagination {
  page?: number;
  pageSize?: number;
}

@Injectable()
export class MarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acquisitions: AcquisitionsService,
  ) {}

  // ── 首页聚合：5 类各取 6 张 + 编辑精选 4 张 + 平台统计 ───────────────
  async getHome() {
    const [skills, mcps, agents, imageTpls, videoTpls] = await Promise.all([
      this.prisma.skills.findMany({
        where: { status: TemplateStatus.APPROVED },
        orderBy: { useCount: 'desc' },
        take: 6,
      }),
      this.prisma.mcp_servers.findMany({
        where: { status: TemplateStatus.APPROVED },
        orderBy: { useCount: 'desc' },
        take: 6,
      }),
      this.prisma.agents.findMany({
        where: { status: TemplateStatus.APPROVED },
        orderBy: { useCount: 'desc' },
        take: 6,
      }),
      this.prisma.image_templates.findMany({
        where: { status: TemplateStatus.APPROVED },
        orderBy: { useCount: 'desc' },
        take: 6,
      }),
      this.prisma.video_templates.findMany({
        where: { status: TemplateStatus.APPROVED },
        orderBy: { useCount: 'desc' },
        take: 6,
      }),
    ]);

    return {
      categories: {
        skills: this.tag(skills, ResourceType.SKILL),
        mcp: this.tag(mcps, ResourceType.MCP),
        agents: this.tag(agents, ResourceType.AGENT),
        imageTemplates: this.tag(imageTpls, ResourceType.IMAGE_TEMPLATE),
        videoTemplates: this.tag(videoTpls, ResourceType.VIDEO_TEMPLATE),
      },
      hotRanking: await this.getHotRankings(5),
      editorPicks: await this.getEditorPicks(4),
      stats: await this.getPlatformStats(),
    };
  }

  // ── 热门排行(跨 5 类) ─────────────────────────────────────────────
  async getHotRankings(limit = 10) {
    const where = { status: TemplateStatus.APPROVED };
    const orderBy = { useCount: 'desc' as const };
    const [skills, mcps, agents, img, vid] = await Promise.all([
      this.prisma.skills.findMany({ where, orderBy, take: limit }),
      this.prisma.mcp_servers.findMany({ where, orderBy, take: limit }),
      this.prisma.agents.findMany({ where, orderBy, take: limit }),
      this.prisma.image_templates.findMany({ where, orderBy, take: limit }),
      this.prisma.video_templates.findMany({ where, orderBy, take: limit }),
    ]);
    const merged = [
      ...this.tag(skills, ResourceType.SKILL),
      ...this.tag(mcps, ResourceType.MCP),
      ...this.tag(agents, ResourceType.AGENT),
      ...this.tag(img, ResourceType.IMAGE_TEMPLATE),
      ...this.tag(vid, ResourceType.VIDEO_TEMPLATE),
    ];
    merged.sort(
      (a, b) =>
        (b as { useCount: number }).useCount -
        (a as { useCount: number }).useCount,
    );
    return merged.slice(0, limit);
  }

  // ── 编辑精选(取喜欢数最高) ─────────────────────────────────────────
  async getEditorPicks(limit = 4) {
    const where = { status: TemplateStatus.APPROVED };
    const orderBy = { likeCount: 'desc' as const };
    const [skills, mcps, agents, img, vid] = await Promise.all([
      this.prisma.skills.findMany({ where, orderBy, take: limit }),
      this.prisma.mcp_servers.findMany({ where, orderBy, take: limit }),
      this.prisma.agents.findMany({ where, orderBy, take: limit }),
      this.prisma.image_templates.findMany({ where, orderBy, take: limit }),
      this.prisma.video_templates.findMany({ where, orderBy, take: limit }),
    ]);
    const merged = [
      ...this.tag(skills, ResourceType.SKILL),
      ...this.tag(mcps, ResourceType.MCP),
      ...this.tag(agents, ResourceType.AGENT),
      ...this.tag(img, ResourceType.IMAGE_TEMPLATE),
      ...this.tag(vid, ResourceType.VIDEO_TEMPLATE),
    ];
    merged.sort(
      (a, b) =>
        (b as { likeCount: number }).likeCount -
        (a as { likeCount: number }).likeCount,
    );
    return merged.slice(0, limit);
  }

  async getPlatformStats() {
    const where = { status: TemplateStatus.APPROVED };
    const [skill, mcp, agent, img, vid, totalAcq] = await Promise.all([
      this.prisma.skills.count({ where }),
      this.prisma.mcp_servers.count({ where }),
      this.prisma.agents.count({ where }),
      this.prisma.image_templates.count({ where }),
      this.prisma.video_templates.count({ where }),
      this.prisma.user_resource_acquisitions.count(),
    ]);
    return {
      totalResources: skill + mcp + agent + img + vid,
      bySkillCount: skill,
      byMcpCount: mcp,
      byAgentCount: agent,
      byImageTemplateCount: img,
      byVideoTemplateCount: vid,
      totalAcquisitions: totalAcq,
    };
  }

  // ── 我的中心:聚合多 tab 数据 ────────────────────────────────────────
  async getMyResources(
    userId: string,
    tab: 'acquired' | 'favorites' | 'published' | 'history' | 'generations',
    pagination: Pagination = {},
  ) {
    const page = pagination.page ?? 1;
    const pageSize = Math.min(pagination.pageSize ?? 20, 50);
    const skip = (page - 1) * pageSize;

    if (tab === 'acquired') {
      return { items: await this.acquisitions.listAcquired(userId) };
    }

    if (tab === 'favorites') {
      const rows = await this.prisma.resource_favorites.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      });
      const enriched = await this.enrichByResources(rows);
      const total = await this.prisma.resource_favorites.count({
        where: { userId },
      });
      return { items: enriched, total, page, pageSize };
    }

    if (tab === 'published') {
      const where = { authorId: userId };
      const orderBy = { createdAt: 'desc' as const };
      const [skills, mcps, agents, img, vid] = await Promise.all([
        this.prisma.skills.findMany({ where, orderBy }),
        this.prisma.mcp_servers.findMany({ where, orderBy }),
        this.prisma.agents.findMany({ where, orderBy }),
        this.prisma.image_templates.findMany({ where, orderBy }),
        this.prisma.video_templates.findMany({ where, orderBy }),
      ]);
      return {
        items: [
          ...this.tag(skills, ResourceType.SKILL),
          ...this.tag(mcps, ResourceType.MCP),
          ...this.tag(agents, ResourceType.AGENT),
          ...this.tag(img, ResourceType.IMAGE_TEMPLATE),
          ...this.tag(vid, ResourceType.VIDEO_TEMPLATE),
        ],
      };
    }

    if (tab === 'history') {
      const rows = await this.prisma.resource_views.findMany({
        where: { userId },
        orderBy: { viewedAt: 'desc' },
        skip,
        take: pageSize,
      });
      const enriched = await this.enrichByResources(rows);
      const total = await this.prisma.resource_views.count({
        where: { userId },
      });
      return { items: enriched, total, page, pageSize };
    }

    if (tab === 'generations') {
      const [imgGens, vidGens] = await Promise.all([
        this.prisma.image_generations.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          skip,
          take: pageSize,
          include: {
            template: {
              select: { title: true, coverImage: true, category: true },
            },
          },
        }),
        this.prisma.video_generations.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          skip,
          take: pageSize,
          include: {
            template: {
              select: { title: true, coverImage: true, category: true },
            },
          },
        }),
      ]);
      return {
        items: [
          ...imgGens.map((g) => ({
            ...g,
            generationType: ResourceType.IMAGE_TEMPLATE,
          })),
          ...vidGens.map((g) => ({
            ...g,
            generationType: ResourceType.VIDEO_TEMPLATE,
          })),
        ],
      };
    }

    return { items: [] };
  }

  // ── helpers ──────────────────────────────────────────────────────────
  private tag<T>(items: T[], type: ResourceType) {
    return items.map((item) => ({ ...item, resourceType: type }));
  }

  private async enrichByResources<
    T extends { resourceType: ResourceType; resourceId: string },
  >(rows: T[]) {
    const grouped = rows.reduce<Record<ResourceType, string[]>>(
      (acc, r) => {
        const arr = acc[r.resourceType] ?? [];
        arr.push(r.resourceId);
        acc[r.resourceType] = arr;
        return acc;
      },
      {} as Record<ResourceType, string[]>,
    );

    const detailMap = new Map<string, unknown>();
    for (const [t, ids] of Object.entries(grouped)) {
      if (ids.length === 0) continue;
      const where = { id: { in: ids } };
      let items: { id: string }[] = [];
      switch (t as ResourceType) {
        case ResourceType.SKILL:
          items = await this.prisma.skills.findMany({ where });
          break;
        case ResourceType.MCP:
          items = await this.prisma.mcp_servers.findMany({ where });
          break;
        case ResourceType.AGENT:
          items = await this.prisma.agents.findMany({ where });
          break;
        case ResourceType.IMAGE_TEMPLATE:
          items = await this.prisma.image_templates.findMany({ where });
          break;
        case ResourceType.VIDEO_TEMPLATE:
          items = await this.prisma.video_templates.findMany({ where });
          break;
      }
      for (const it of items) detailMap.set(`${t}:${it.id}`, it);
    }

    return rows.map((r) => ({
      ...r,
      resource: detailMap.get(`${r.resourceType}:${r.resourceId}`),
    }));
  }
}
