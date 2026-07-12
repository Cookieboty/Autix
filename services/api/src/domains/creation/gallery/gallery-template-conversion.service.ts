import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  GalleryKind,
  GalleryStatus,
  ImageTemplateSource,
  Prisma,
  TemplateStatus,
} from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { GalleryRepository } from './gallery.repository';

/**
 * Plan C Task 9：广场作品 → 图片模板的管理端转换。
 * 仅 PUBLISHED + IMAGE + prompt 非空的作品可转换；转换后模板直接 APPROVED
 * 并记录 reviewedById/reviewedAt（管理员发起即视为已审），不改动原作品状态。
 *
 * 幂等：sourceGalleryPostId 在 image_templates 上有 @unique 约束，重复转换
 * 同一作品应返回已存在的模板（200），不新建、不抛错——find-first 覆盖常规路径，
 * create 撞上 P2002（并发下两次转换请求同时 miss 掉 find-first）时兜底 re-find，
 * 与 resource-metrics.repository 的 tryCreateUnique（create-first + 吞 P2002）同一思路。
 */
@Injectable()
export class GalleryTemplateConversionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: GalleryRepository,
  ) {}

  async convertToTemplate(adminId: string, galleryId: string) {
    const gallery = await this.repo.findById(galleryId);
    if (!gallery) {
      throw new NotFoundException('作品不存在');
    }
    if (gallery.status !== GalleryStatus.PUBLISHED || gallery.kind !== GalleryKind.IMAGE) {
      throw new BadRequestException('仅已发布的图片作品可转换为模板');
    }
    if (!gallery.prompt) {
      throw new BadRequestException('作品缺少提示词，无法转换为模板');
    }

    const existing = await this.prisma.image_templates.findUnique({
      where: { sourceGalleryPostId: galleryId },
    });
    if (existing) {
      return existing;
    }

    const now = new Date();
    const data: Prisma.image_templatesUncheckedCreateInput = {
      title: gallery.title ?? `来自作品 ${galleryId.slice(0, 8)}`,
      category: gallery.category,
      prompt: gallery.prompt,
      variables: {},
      coverImage: gallery.coverImage ?? gallery.mediaUrls[0] ?? null,
      exampleImages: gallery.mediaUrls ?? [],
      modelHint: gallery.model ?? null,
      sourceType: ImageTemplateSource.GALLERY_CONVERSION,
      sourceGalleryPostId: galleryId,
      authorId: gallery.authorId,
      createdById: adminId,
      status: TemplateStatus.APPROVED,
      reviewedById: adminId,
      reviewedAt: now,
    };

    try {
      const created = await this.prisma.image_templates.create({ data });
      await this.repo.writeAuditLog('gallery.convertToTemplate', adminId, {
        targetType: 'gallery_post',
        targetId: galleryId,
        templateId: created.id,
      });
      return created;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const raceWinner = await this.prisma.image_templates.findUnique({
          where: { sourceGalleryPostId: galleryId },
        });
        if (raceWinner) {
          return raceWinner;
        }
      }
      throw err;
    }
  }
}
