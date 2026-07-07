import { Injectable } from '@nestjs/common';
import { FeaturedSlotKind, Prisma, ResourceType } from '../prisma/generated';
import { PrismaService } from '../prisma/prisma.service';
import type { FeaturedSlotSource } from './featured-slots.helpers';

export interface CreateFeaturedSlotData {
  placement: string;
  kind: FeaturedSlotKind;
  resourceType?: ResourceType | null;
  resourceId?: string | null;
  overrideTitle?: string | null;
  overrideDescription?: string | null;
  overrideCoverImage?: string | null;
  overrideCoverVideo?: string | null;
  overrideCtaText?: string | null;
  overrideCtaHref?: string | null;
  position: number;
  isEnabled?: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
  createdById: string;
}

export type UpdateFeaturedSlotData = Partial<
  Omit<CreateFeaturedSlotData, 'createdById' | 'placement' | 'position'>
>;

/**
 * 运营位（featured_slots）数据访问层。见 gallery-design.md §5.5 / §十。
 * 读路径分 listByPlacement（前台，按 enabledOnly+排期窗口过滤）与
 * listAllByPlacement（后台，含禁用项）。
 */
@Injectable()
export class FeaturedSlotsRepository {
  constructor(private readonly prisma: PrismaService) {}

  listByPlacement(
    placement: string,
    opts: { enabledOnly?: boolean; now?: Date } = {},
  ) {
    const { enabledOnly = false, now = new Date() } = opts;
    const where: Prisma.featured_slotsWhereInput = {
      placement,
      ...(enabledOnly
        ? {
            isEnabled: true,
            AND: [
              { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
              { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
            ],
          }
        : {}),
    };
    return this.prisma.featured_slots.findMany({
      where,
      orderBy: { position: 'asc' },
    });
  }

  /** 后台列表：含禁用项，不做排期窗口过滤。 */
  listAllByPlacement(placement: string) {
    return this.prisma.featured_slots.findMany({
      where: { placement },
      orderBy: { position: 'asc' },
    });
  }

  findById(id: string) {
    return this.prisma.featured_slots.findUnique({ where: { id } });
  }

  create(data: CreateFeaturedSlotData) {
    return this.prisma.featured_slots.create({ data });
  }

  update(id: string, data: UpdateFeaturedSlotData) {
    return this.prisma.featured_slots.update({ where: { id }, data });
  }

  delete(id: string) {
    return this.prisma.featured_slots.delete({ where: { id } });
  }

  /**
   * 重排 placement 下的 position（0..n-1，按 orderedIds 给定顺序）。
   * `@@unique([placement, position])` 意味着不能在同一事务里直接把某行改成
   * 另一行当前占用的 position——两阶段：先把受影响的行全部挪到互不冲突的
   * 临时负数位，再统一写回 0..n-1，避免中途撞到唯一约束。
   * 约定 orderedIds 覆盖该 placement 下全部行；未出现的行不会被本方法感知或移动。
   */
  async reorder(placement: string, orderedIds: string[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.featured_slots.update({
          where: { id: orderedIds[i], placement },
          data: { position: -(i + 1) },
        });
      }
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.featured_slots.update({
          where: { id: orderedIds[i], placement },
          data: { position: i },
        });
      }
    });
  }

  searchImageTemplateCandidates(query: string) {
    return this.prisma.image_templates.findMany({
      where: {
        status: 'APPROVED',
        ...(query ? { title: { contains: query, mode: 'insensitive' } } : {}),
      },
      select: { id: true, title: true },
      orderBy: { publishedAt: 'desc' },
      take: 20,
    });
  }

  searchVideoTemplateCandidates(query: string) {
    return this.prisma.video_templates.findMany({
      where: {
        status: 'APPROVED',
        ...(query ? { title: { contains: query, mode: 'insensitive' } } : {}),
      },
      select: { id: true, title: true },
      orderBy: { publishedAt: 'desc' },
      take: 20,
    });
  }

  searchGalleryPostCandidates(query: string) {
    return this.prisma.gallery_posts.findMany({
      where: {
        status: 'PUBLISHED',
        ...(query ? { title: { contains: query, mode: 'insensitive' } } : {}),
      },
      select: { id: true, title: true },
      orderBy: { publishedAt: 'desc' },
      take: 20,
    });
  }

  /**
   * kind=RESOURCE 运营位的展示来源（§十 resolveSlot 的 source 入参）：best-effort，
   * 找不到目标资源（已被删除/下线）时返回 null，交由调用方回落到 override-only。
   * 目前只覆盖会出现在运营位里的三类资源：图片/视频模板、广场作品。
   */
  async getResourceSource(
    resourceType: ResourceType,
    resourceId: string,
  ): Promise<FeaturedSlotSource | null> {
    switch (resourceType) {
      case ResourceType.IMAGE_TEMPLATE: {
        const row = await this.prisma.image_templates.findUnique({
          where: { id: resourceId },
          select: {
            title: true,
            description: true,
            coverImage: true,
            exampleImages: true,
          },
        });
        if (!row) return null;
        return {
          title: row.title,
          description: row.description,
          coverImage: row.coverImage ?? row.exampleImages[0] ?? null,
          href: `/marketplace/image-templates/${resourceId}`,
        };
      }
      case ResourceType.VIDEO_TEMPLATE: {
        const row = await this.prisma.video_templates.findUnique({
          where: { id: resourceId },
          select: {
            title: true,
            description: true,
            coverImage: true,
            exampleMedia: true,
          },
        });
        if (!row) return null;
        return {
          title: row.title,
          description: row.description,
          coverImage: row.coverImage ?? row.exampleMedia[0] ?? null,
          href: `/marketplace/video-templates/${resourceId}`,
        };
      }
      case ResourceType.GALLERY_POST: {
        const row = await this.prisma.gallery_posts.findUnique({
          where: { id: resourceId },
          select: { title: true, description: true, coverImage: true },
        });
        if (!row) return null;
        return {
          title: row.title,
          description: row.description,
          coverImage: row.coverImage,
          href: `/gallery/${resourceId}`,
        };
      }
      default:
        return null;
    }
  }
}
