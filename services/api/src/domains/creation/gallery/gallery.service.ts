import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '@autix/domain';
import { GalleryStatus } from '../../platform/prisma/generated';
import { GalleryRepository } from './gallery.repository';
import { assertSource, assertTransition, type GallerySourcePayload } from './gallery.helpers';
import type { CreateGalleryDraftDto } from './dto/create-gallery-draft.dto';
import type { CreateGalleryPostDto } from './dto/create-gallery-post.dto';
import type { UpdateGalleryPostDto } from './dto/update-gallery-post.dto';
import type { RejectGalleryPostDto } from './dto/reject-post.dto';
import type { ResolveGalleryReportDto } from './dto/resolve-report.dto';
import type { CreateGalleryReportDto } from './dto/create-report.dto';

/** 与 AdminGuard 一致的管理员判定，供"公开详情按角色可见性"复用（见 §5.1.1）。 */
export function isAdminUser(user: AuthUser | undefined): boolean {
  if (!user) return false;
  const roles = Array.isArray(user.roles) ? user.roles : [];
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  return (
    !!user.isSuperAdmin ||
    roles.includes('SYSTEM_ADMIN') ||
    roles.includes('ADMIN') ||
    roles.includes('SUPER_ADMIN') ||
    permissions.includes('admin:access') ||
    permissions.includes('system:admin')
  );
}

function toSourcePayload(row: {
  kind: string;
  sourceType: string;
  mediaUrls: string[];
  imageTemplateId: string | null;
  videoTemplateId: string | null;
  imageGenerationId: string | null;
  videoGenerationId: string | null;
}): GallerySourcePayload {
  return {
    kind: row.kind as GallerySourcePayload['kind'],
    sourceType: row.sourceType as GallerySourcePayload['sourceType'],
    mediaUrls: row.mediaUrls,
    imageTemplateId: row.imageTemplateId,
    videoTemplateId: row.videoTemplateId,
    imageGenerationId: row.imageGenerationId,
    videoGenerationId: row.videoGenerationId,
  };
}

@Injectable()
export class GalleryService {
  constructor(private readonly repo: GalleryRepository) {}

  private async assertOwnership(dto: {
    sourceType: string;
    imageGenerationId?: string | null;
    videoGenerationId?: string | null;
  }, authorId: string): Promise<void> {
    if (dto.sourceType !== 'FROM_GENERATION') return;
    // TODO: image_generations/video_generations 归属校验，best-effort ——
    // 查不到就放行，不阻塞投稿（见任务说明）。
    try {
      if (dto.imageGenerationId) {
        const gen = await this.repo.findImageGenerationOwner(dto.imageGenerationId);
        if (gen && gen.userId !== authorId) {
          throw new ForbiddenException('该生成记录不属于当前用户');
        }
      } else if (dto.videoGenerationId) {
        const gen = await this.repo.findVideoGenerationOwner(dto.videoGenerationId);
        if (gen && gen.userId !== authorId) {
          throw new ForbiddenException('该生成记录不属于当前用户');
        }
      }
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      // 查询异常不阻塞投稿，仅放行（best-effort）。
    }
  }

  /** POST /gallery：完整投稿，先审后发 → 直接 PENDING，不设 publishedAt。 */
  async createSubmission(authorId: string, dto: CreateGalleryPostDto) {
    assertSource(dto as GallerySourcePayload, 'author');
    await this.assertOwnership(dto, authorId);

    return this.repo.create({
      kind: dto.kind,
      title: dto.title,
      description: dto.description,
      category: dto.category,
      tags: dto.tags ?? [],
      coverImage: dto.coverImage,
      mediaUrls: dto.mediaUrls ?? [],
      aspectRatio: dto.aspectRatio,
      durationSec: dto.durationSec,
      sourceType: dto.sourceType,
      imageTemplateId: dto.imageTemplateId,
      videoTemplateId: dto.videoTemplateId,
      imageGenerationId: dto.imageGenerationId,
      videoGenerationId: dto.videoGenerationId,
      status: GalleryStatus.PENDING,
      authorId,
    });
  }

  /** POST /gallery/drafts：草稿，字段可不完整，不做 assertSource。 */
  async createDraft(authorId: string, dto: CreateGalleryDraftDto) {
    return this.repo.create({
      kind: dto.kind,
      title: dto.title,
      description: dto.description,
      category: dto.category ?? '',
      tags: dto.tags ?? [],
      coverImage: dto.coverImage,
      mediaUrls: dto.mediaUrls ?? [],
      aspectRatio: dto.aspectRatio,
      durationSec: dto.durationSec,
      sourceType: dto.sourceType,
      imageTemplateId: dto.imageTemplateId,
      videoTemplateId: dto.videoTemplateId,
      imageGenerationId: dto.imageGenerationId,
      videoGenerationId: dto.videoGenerationId,
      status: GalleryStatus.DRAFT,
      authorId,
    });
  }

  private async getOwned(id: string, authorId: string) {
    const post = await this.repo.findById(id);
    if (!post) throw new NotFoundException('作品不存在');
    if (post.authorId !== authorId) {
      throw new ForbiddenException('仅作者本人可操作');
    }
    return post;
  }

  /** PATCH /gallery/drafts/:id：作者本人 + 仍为 DRAFT 才可编辑。 */
  async updateDraft(authorId: string, id: string, dto: UpdateGalleryPostDto) {
    const post = await this.getOwned(id, authorId);
    if (post.status !== GalleryStatus.DRAFT) {
      throw new BadRequestException('仅草稿状态可编辑草稿');
    }
    return this.repo.update(id, { ...dto });
  }

  /** POST /gallery/:id/submit：DRAFT → PENDING，提交时用当前记录字段跑 assertSource。 */
  async submitDraft(authorId: string, id: string) {
    const post = await this.getOwned(id, authorId);
    assertTransition(post.status, GalleryStatus.PENDING, 'author');
    assertSource(toSourcePayload(post), 'author');
    await this.assertOwnership(
      {
        sourceType: post.sourceType,
        imageGenerationId: post.imageGenerationId,
        videoGenerationId: post.videoGenerationId,
      },
      authorId,
    );
    return this.repo.update(id, { status: GalleryStatus.PENDING });
  }

  /** PATCH /gallery/:id：作者本人可编辑基础字段（不改 status/kind）。 */
  async updatePost(authorId: string, id: string, dto: UpdateGalleryPostDto) {
    await this.getOwned(id, authorId);
    return this.repo.update(id, { ...dto });
  }

  /** DELETE /gallery/:id：作者本人 → REMOVED；非法转移/非作者由 assertTransition/getOwned 抛错。 */
  async removePost(authorId: string, id: string) {
    const post = await this.getOwned(id, authorId);
    assertTransition(post.status, GalleryStatus.REMOVED, 'author');
    return this.repo.update(id, { status: GalleryStatus.REMOVED });
  }

  /** GET /gallery/:id：非 PUBLISHED 仅作者本人或管理员可见。 */
  async getVisible(id: string, user: AuthUser | undefined) {
    const post = await this.repo.findById(id);
    if (!post) throw new NotFoundException('作品不存在');
    if (post.status !== GalleryStatus.PUBLISHED) {
      const isOwner = !!user && post.authorId === user.id;
      if (!isOwner && !isAdminUser(user)) {
        throw new NotFoundException('作品不存在');
      }
    }
    return post;
  }

  async report(reporterId: string, postId: string, dto: CreateGalleryReportDto) {
    const post = await this.repo.findById(postId);
    if (!post) throw new NotFoundException('作品不存在');
    return this.repo.createReport({
      postId,
      reporterId,
      reason: dto.reason,
    });
  }

  // ── 管理端 ──────────────────────────────────────────────────────────

  async listPending(cursor: string | undefined, take: number) {
    return this.repo.findPendingPage(cursor, take);
  }

  private async requirePost(id: string) {
    const post = await this.repo.findById(id);
    if (!post) throw new NotFoundException('作品不存在');
    return post;
  }

  async approve(adminId: string, id: string) {
    const post = await this.requirePost(id);
    assertTransition(post.status, GalleryStatus.PUBLISHED, 'admin');
    const now = new Date();
    const updated = await this.repo.update(id, {
      status: GalleryStatus.PUBLISHED,
      publishedAt: now,
      reviewedById: adminId,
      reviewedAt: now,
    });
    await this.repo.writeAuditLog('gallery.approve', adminId, {
      targetType: 'gallery_post',
      targetId: id,
    });
    return updated;
  }

  async reject(adminId: string, id: string, dto: RejectGalleryPostDto) {
    const post = await this.requirePost(id);
    assertTransition(post.status, GalleryStatus.REJECTED, 'admin');
    const now = new Date();
    const updated = await this.repo.update(id, {
      status: GalleryStatus.REJECTED,
      rejectReason: dto.reason,
      reviewedById: adminId,
      reviewedAt: now,
    });
    await this.repo.writeAuditLog('gallery.reject', adminId, {
      targetType: 'gallery_post',
      targetId: id,
      reason: dto.reason,
    });
    return updated;
  }

  async hide(adminId: string, id: string) {
    const post = await this.requirePost(id);
    assertTransition(post.status, GalleryStatus.HIDDEN, 'admin');
    const updated = await this.repo.update(id, { status: GalleryStatus.HIDDEN });
    await this.repo.writeAuditLog('gallery.hide', adminId, {
      targetType: 'gallery_post',
      targetId: id,
    });
    return updated;
  }

  async remove(adminId: string, id: string) {
    const post = await this.requirePost(id);
    assertTransition(post.status, GalleryStatus.REMOVED, 'admin');
    const updated = await this.repo.update(id, { status: GalleryStatus.REMOVED });
    await this.repo.writeAuditLog('gallery.remove', adminId, {
      targetType: 'gallery_post',
      targetId: id,
    });
    return updated;
  }

  async resolveReport(adminId: string, id: string, dto: ResolveGalleryReportDto) {
    const report = await this.repo.findReportById(id);
    if (!report) throw new NotFoundException('举报不存在');
    const updated = await this.repo.updateReport(id, {
      status: dto.status,
      resolvedById: adminId,
      resolvedAt: new Date(),
    });
    await this.repo.writeAuditLog('gallery.report.resolve', adminId, {
      targetType: 'gallery_report',
      targetId: id,
      status: dto.status,
    });
    return updated;
  }
}
