import { Injectable } from '@nestjs/common';
import { Prisma, GalleryStatus } from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';

/** gallery_posts / gallery_reports 的数据访问层。所有状态迁移由 service 层用 assertTransition 校验后再调用这里。 */
@Injectable()
export class GalleryRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.gallery_posts.findUnique({ where: { id } });
  }

  create(data: Prisma.gallery_postsUncheckedCreateInput) {
    return this.prisma.gallery_posts.create({ data });
  }

  update(id: string, data: Prisma.gallery_postsUncheckedUpdateInput) {
    return this.prisma.gallery_posts.update({ where: { id }, data });
  }

  /** 待审列表（PENDING，createdAt 升序，游标为上一页最后一条的 id）。 */
  async findPendingPage(cursor: string | undefined, take: number) {
    const rows = await this.prisma.gallery_posts.findMany({
      where: { status: GalleryStatus.PENDING },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
    };
  }

  findReportById(id: string) {
    return this.prisma.gallery_reports.findUnique({ where: { id } });
  }

  createReport(data: Prisma.gallery_reportsUncheckedCreateInput) {
    return this.prisma.gallery_reports.create({ data });
  }

  updateReport(id: string, data: Prisma.gallery_reportsUncheckedUpdateInput) {
    return this.prisma.gallery_reports.update({ where: { id }, data });
  }

  findImageGenerationOwner(id: string) {
    return this.prisma.image_generations.findUnique({
      where: { id },
      select: { userId: true },
    });
  }

  findVideoGenerationOwner(id: string) {
    return this.prisma.video_generations.findUnique({
      where: { id },
      select: { userId: true },
    });
  }

  writeAuditLog(action: string, actorId: string, payload: Record<string, unknown>) {
    return this.prisma.admin_audit_logs.create({
      data: {
        action,
        actorId,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
    });
  }
}
