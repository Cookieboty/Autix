import { Injectable } from '@nestjs/common';
import { ResourceType } from '../../platform/prisma/generated';
import { AcquisitionsService } from '../acquisitions/acquisitions.service';
import { MarketplaceActivityRepository } from '../marketplace-activity.repository';
import { MarketplaceQueryRepository } from '../marketplace-query.repository';
import { MarketplaceResourceRepository } from '../marketplace-resource.repository';

interface Pagination {
  page?: number;
  pageSize?: number;
}

@Injectable()
export class MarketplaceService {
  constructor(
    private readonly acquisitions: AcquisitionsService,
    private readonly activity: MarketplaceActivityRepository,
    private readonly queries: MarketplaceQueryRepository,
    private readonly resources: MarketplaceResourceRepository,
  ) {}

  // ── 首页聚合：5 类各取 6 张 + 编辑精选 4 张 + 平台统计 ───────────────
  async getHome() {
    const { skills, mcps, agents, imageTemplates, videoTemplates } =
      await this.queries.findHomeCategoryRows(6);

    return {
      categories: {
        skills: this.tag(skills, ResourceType.SKILL),
        mcp: this.tag(mcps, ResourceType.MCP),
        agents: this.tag(agents, ResourceType.AGENT),
        imageTemplates: this.tag(
          imageTemplates,
          ResourceType.IMAGE_TEMPLATE,
        ),
        videoTemplates: this.tag(
          videoTemplates,
          ResourceType.VIDEO_TEMPLATE,
        ),
      },
      hotRanking: await this.getHotRankings(5),
      editorPicks: await this.getEditorPicks(4),
      stats: await this.getPlatformStats(),
    };
  }

  // ── 热门排行(仅图片/视频模板, hot-first) ─────────────────────────────
  async getHotRankings(limit = 10) {
    const { imageTemplates, videoTemplates } =
      await this.queries.findHotTemplateRows(limit);
    const merged = [
      ...this.tag(imageTemplates, ResourceType.IMAGE_TEMPLATE),
      ...this.tag(videoTemplates, ResourceType.VIDEO_TEMPLATE),
    ];
    merged.sort((a, b) => {
      const aHot = (a as { isHot?: boolean }).isHot ? 1 : 0;
      const bHot = (b as { isHot?: boolean }).isHot ? 1 : 0;
      if (bHot !== aHot) return bHot - aHot;
      return (
        (b as { useCount: number }).useCount -
        (a as { useCount: number }).useCount
      );
    });
    return merged.slice(0, limit);
  }

  // ── 编辑精选(取喜欢数最高) ─────────────────────────────────────────
  async getEditorPicks(limit = 4) {
    const { skills, mcps, agents, imageTemplates, videoTemplates } =
      await this.queries.findEditorPickRows(limit);
    const merged = [
      ...this.tag(skills, ResourceType.SKILL),
      ...this.tag(mcps, ResourceType.MCP),
      ...this.tag(agents, ResourceType.AGENT),
      ...this.tag(imageTemplates, ResourceType.IMAGE_TEMPLATE),
      ...this.tag(videoTemplates, ResourceType.VIDEO_TEMPLATE),
    ];
    merged.sort(
      (a, b) =>
        (b as { likeCount: number }).likeCount -
        (a as { likeCount: number }).likeCount,
    );
    return merged.slice(0, limit);
  }

  async getPlatformStats() {
    const {
      skillCount,
      mcpCount,
      agentCount,
      imageTemplateCount,
      videoTemplateCount,
      acquisitionCount,
    } = await this.queries.findPlatformStatsRows();
    return {
      totalResources:
        skillCount +
        mcpCount +
        agentCount +
        imageTemplateCount +
        videoTemplateCount,
      bySkillCount: skillCount,
      byMcpCount: mcpCount,
      byAgentCount: agentCount,
      byImageTemplateCount: imageTemplateCount,
      byVideoTemplateCount: videoTemplateCount,
      totalAcquisitions: acquisitionCount,
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
      const rows = await this.activity.listFavorites(userId, skip, pageSize);
      const enriched = await this.resources.attachResources(rows);
      const total = await this.activity.countFavorites(userId);
      return { items: enriched, total, page, pageSize };
    }

    if (tab === 'published') {
      const { skills, mcps, agents, imageTemplates, videoTemplates } =
        await this.queries.findPublishedRows(userId);
      return {
        items: [
          ...this.tag(skills, ResourceType.SKILL),
          ...this.tag(mcps, ResourceType.MCP),
          ...this.tag(agents, ResourceType.AGENT),
          ...this.tag(imageTemplates, ResourceType.IMAGE_TEMPLATE),
          ...this.tag(videoTemplates, ResourceType.VIDEO_TEMPLATE),
        ],
      };
    }

    if (tab === 'history') {
      const rows = await this.activity.listViews(userId, skip, pageSize);
      const enriched = await this.resources.attachResources(rows);
      const total = await this.activity.countViews(userId);
      return { items: enriched, total, page, pageSize };
    }

    if (tab === 'generations') {
      const { imageGenerations, videoGenerations } =
        await this.queries.findGenerationRows(userId, skip, pageSize);
      return {
        items: [
          ...imageGenerations.map((g) => ({
            ...g,
            generationType: ResourceType.IMAGE_TEMPLATE,
          })),
          ...videoGenerations.map((g) => ({
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

}
