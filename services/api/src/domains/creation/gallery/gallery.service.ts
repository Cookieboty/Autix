import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '@autix/domain';
import { GalleryKind, GalleryStatus, Prisma, ResourceType } from '../../platform/prisma/generated';
import { ResourceMetricsService } from '../../platform/resource-metrics/resource-metrics.service';
import { ResourceInteractionRepository } from '../../platform/common/resource-interaction.repository';
import { CloudflareR2Service } from '../../platform/storage/cloudflare-r2.service';
import { GalleryRepository } from './gallery.repository';
import { presentAuthor, type PresentedAuthor } from './gallery-author.presenter';
import {
  assertInStationMediaUrls,
  assertSource,
  assertTransition,
  buildAdminGalleryWhere,
  normalizeAdminGalleryQuery,
  type GallerySourcePayload,
} from './gallery.helpers';
import type { CreateGalleryDraftDto } from './dto/create-gallery-draft.dto';
import type { CreateGalleryPostDto } from './dto/create-gallery-post.dto';
import type { UpdateGalleryPostDto } from './dto/update-gallery-post.dto';
import type { RejectGalleryPostDto } from './dto/reject-post.dto';
import type { ResolveGalleryReportDto } from './dto/resolve-report.dto';
import type { CreateGalleryReportDto } from './dto/create-report.dto';
import {
  deriveGenerationMediaUrls,
  snapshotGenerationMetadata,
  type GallerySnapshotFields,
} from '../image-gen/image-gen-gallery-submission';

/**
 * findImageGenerationOwner/findVideoGenerationOwner 的返回形状：归属判定 + 快照来源共用。
 * mediaUrls：统一自 generatedImages（图片）/ generatedVideos（视频）映射而来，供
 * Task 4.5 的 FROM_GENERATION 媒体派生使用（见 deriveGenerationMediaUrls）。
 */
interface GenerationOwnershipRecord {
  userId: string;
  resolvedPrompt: string;
  modelUsed: string;
  width?: number | null;
  height?: number | null;
  referenceImage: string | null;
  mediaUrls: string[];
}

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
  constructor(
    private readonly repo: GalleryRepository,
    private readonly metrics: ResourceMetricsService,
    private readonly r2: CloudflareR2Service,
    // Plan C Task 7：详情 viewer 状态批量查询 + 登录态双写 resource_views。可选参数沿用
    // BaseResourceService 的写法，让既有 3 参构造的纯单测（feed/download/recreate）无需改动；
    // 生产环境经 DI 恒注入真实实例。
    private readonly interactions?: ResourceInteractionRepository,
  ) {}

  /** 管理端广场列表：页码分页 + 筛选（kind/category/sourceType/标题搜索/仅非我域名），返回 total。 */
  async listAdminPage(rawQuery: Record<string, unknown>) {
    const q = normalizeAdminGalleryQuery(rawQuery);
    const r2Base = q.externalOnly ? (await this.r2.getPublicBaseUrl()) || null : null;
    const where = buildAdminGalleryWhere(q, r2Base);
    const { items, total } = await this.repo.findAdminPage(where, q.page, q.pageSize);
    return {
      items,
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
    };
  }

  /** 管理端分类下拉数据。 */
  async listCategories(): Promise<string[]> {
    return this.repo.listDistinctCategories();
  }

  /**
   * FROM_GENERATION 归属校验 —— fail-closed（安全修复，替换原 best-effort 实现）：
   * - 查不到生成记录（`gen == null`）→ 403，不再放行（此前"查不到就放行"会让已删除/伪造 id 蒙混过关）；
   * - 记录存在但不属于当前用户 → 403；
   * - 查询异常直接向上抛，不 catch 吞掉（此前 catch 后静默放行同样是越权漏洞）。
   * 返回命中的生成记录，供调用方复用做元数据快照（避免重复查库）；非 FROM_GENERATION 时返回 undefined。
   */
  private async assertOwnership(dto: {
    sourceType: string;
    imageGenerationId?: string | null;
    videoGenerationId?: string | null;
  }, authorId: string): Promise<GenerationOwnershipRecord | undefined> {
    if (dto.sourceType !== 'FROM_GENERATION') return undefined;

    if (dto.imageGenerationId) {
      const gen = await this.repo.findImageGenerationOwner(dto.imageGenerationId);
      if (gen == null || gen.userId !== authorId) {
        throw new ForbiddenException('生成记录不存在或不属于当前用户');
      }
      return { ...gen, mediaUrls: gen.generatedImages ?? [] };
    }

    if (dto.videoGenerationId) {
      const gen = await this.repo.findVideoGenerationOwner(dto.videoGenerationId);
      if (gen == null || gen.userId !== authorId) {
        throw new ForbiddenException('生成记录不存在或不属于当前用户');
      }
      return { ...gen, mediaUrls: gen.generatedVideos ?? [] };
    }

    return undefined;
  }

  /**
   * 由 assertOwnership 命中的生成记录构造画廊元数据快照。
   * referenceImage 授权：dto.allowPublicReference===true 时直接采信；否则查询该参考图是否
   * 本身就是站内公开可复用资源（PUBLISHED 画廊 / APPROVED 模板 / 用户自有素材）。
   * 均不满足时 referenceImage 快照为 null（保守默认，见任务说明）。
   */
  private async buildGenerationSnapshot(
    generation: GenerationOwnershipRecord | undefined,
    authorId: string,
    allowPublicReference: boolean | undefined,
  ): Promise<GallerySnapshotFields | undefined> {
    if (!generation) return undefined;

    const referenceImageIsPubliclyReusable =
      allowPublicReference !== true && !!generation.referenceImage
        ? await this.repo.isReferenceImagePubliclyReusable(generation.referenceImage, authorId)
        : false;

    return snapshotGenerationMetadata(
      {
        resolvedPrompt: generation.resolvedPrompt,
        modelUsed: generation.modelUsed,
        width: generation.width,
        height: generation.height,
        referenceImage: generation.referenceImage,
      },
      { allowPublicReference, referenceImageIsPubliclyReusable },
    );
  }

  /** 把生成快照展平成 create/update 的元数据字段；无快照（非 FROM_GENERATION）时返回空对象。 */
  private metadataFields(
    snapshot: GallerySnapshotFields | undefined,
  ): Pick<GallerySnapshotFields, 'prompt' | 'model' | 'width' | 'height' | 'referenceImage'> | Record<string, never> {
    if (!snapshot) return {};
    return {
      prompt: snapshot.prompt,
      model: snapshot.model,
      width: snapshot.width,
      height: snapshot.height,
      referenceImage: snapshot.referenceImage,
    };
  }

  /**
   * POST /gallery：完整投稿，先审后发 → 直接 PENDING，不设 publishedAt。
   * FROM_GENERATION 来源的 prompt/model/width/height/referenceImage 从服务端生成记录快照，
   * 不采信 DTO（DTO 本就不携带这些字段）。
   */
  async createSubmission(authorId: string, dto: CreateGalleryPostDto) {
    assertSource(dto as GallerySourcePayload, 'author');
    const generation = await this.assertOwnership(dto, authorId);
    const snapshot = await this.buildGenerationSnapshot(
      generation,
      authorId,
      dto.allowPublicReference,
    );
    const media = await this.resolveSubmissionMedia(dto.sourceType, dto, generation);

    return this.repo.create({
      kind: dto.kind,
      title: dto.title,
      description: dto.description,
      category: dto.category,
      tags: dto.tags ?? [],
      coverImage: media.coverImage,
      mediaUrls: media.mediaUrls,
      aspectRatio: dto.aspectRatio,
      durationSec: dto.durationSec,
      sourceType: dto.sourceType,
      imageTemplateId: dto.imageTemplateId,
      videoTemplateId: dto.videoTemplateId,
      imageGenerationId: dto.imageGenerationId,
      videoGenerationId: dto.videoGenerationId,
      prompt: snapshot?.prompt,
      model: snapshot?.model,
      width: snapshot?.width,
      height: snapshot?.height,
      referenceImage: snapshot?.referenceImage ?? null,
      status: GalleryStatus.PENDING,
      authorId,
    });
  }

  /**
   * 站内媒体 host 校验（Task 4.5/4.6，落实"所有资源来自站内"）：
   * 校验一组 mediaUrls + coverImage 全部命中站内存储域名（CloudflareR2Service.getPublicBaseUrl，
   * 唯一权威来源）；非站内 → 400。空集合直接放行（无媒体可校验）。
   */
  private async validateInStationMedia(
    mediaUrls: readonly string[],
    coverImage?: string | null,
  ): Promise<void> {
    const candidates = coverImage ? [...mediaUrls, coverImage] : [...mediaUrls];
    if (candidates.length === 0) return;
    const r2Base = await this.r2.getPublicBaseUrl();
    assertInStationMediaUrls(candidates, [r2Base], '仅允许使用站内存储的媒体链接');
  }

  /**
   * 投稿媒体来源守卫（Task 4.5，createSubmission 与 submitDraft 共用）：
   * - FROM_GENERATION：完全忽略传入的 mediaUrls/coverImage，从服务端生成记录
   *   （generatedImages/generatedVideos）派生 —— 与 prompt/model 元数据快照同一原则，
   *   不信任客户端存下来的任何东西（DTO 或已落库的 draft 字段）。生成结果为空 → 400。
   * - 其余来源（USER_UPLOAD 等）：校验 mediaUrls/coverImage 命中站内存储域名，非站内 → 400。
   */
  private async resolveSubmissionMedia(
    sourceType: string,
    media: { mediaUrls?: string[] | null; coverImage?: string | null },
    generation: GenerationOwnershipRecord | undefined,
  ): Promise<{ mediaUrls: string[]; coverImage: string | undefined }> {
    if (sourceType === 'FROM_GENERATION') {
      const derived = deriveGenerationMediaUrls({ generatedImages: generation?.mediaUrls });
      if (!derived) {
        throw new BadRequestException('生成结果为空，无法投稿');
      }
      return derived;
    }

    const mediaUrls = media.mediaUrls ?? [];
    await this.validateInStationMedia(mediaUrls, media.coverImage);
    return { mediaUrls, coverImage: media.coverImage ?? undefined };
  }

  /**
   * 草稿阶段媒体守卫（createDraft / updateDraft 共用）：草稿不做归属校验，故无法派生
   * FROM_GENERATION 的站内媒体 —— 一律不持久化任何 DTO 媒体（返回空），提交时（submitDraft）
   * 再从生成记录派生。非 FROM_GENERATION 则校验 host，拒绝把外链持久化进 DRAFT。
   */
  private async resolveDraftMedia(
    sourceType: string | undefined,
    media: { mediaUrls?: string[] | null; coverImage?: string | null },
  ): Promise<{ mediaUrls: string[]; coverImage: string | null }> {
    if (sourceType === 'FROM_GENERATION') {
      return { mediaUrls: [], coverImage: null };
    }
    const mediaUrls = media.mediaUrls ?? [];
    await this.validateInStationMedia(mediaUrls, media.coverImage);
    return { mediaUrls, coverImage: media.coverImage ?? null };
  }

  /**
   * POST /gallery/drafts：草稿，字段可不完整，不做 assertSource。
   * Task 4.6：即便是 DRAFT 也不持久化外链媒体 —— 非 FROM_GENERATION 校验 host，
   * FROM_GENERATION 不采信 DTO 媒体（提交时再从生成记录派生）。
   */
  async createDraft(authorId: string, dto: CreateGalleryDraftDto) {
    const media = await this.resolveDraftMedia(dto.sourceType, dto);
    return this.repo.create({
      kind: dto.kind,
      title: dto.title,
      description: dto.description,
      category: dto.category ?? '',
      tags: dto.tags ?? [],
      coverImage: media.coverImage,
      mediaUrls: media.mediaUrls,
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

  /**
   * PATCH /gallery/drafts/:id：作者本人 + 仍为 DRAFT 才可编辑。
   * Task 4.6：编辑草稿时若带 mediaUrls/coverImage，同样禁止持久化外链 ——
   * 非 FROM_GENERATION 校验 host；FROM_GENERATION 清空媒体（提交时再派生）。
   */
  async updateDraft(authorId: string, id: string, dto: UpdateGalleryPostDto) {
    const post = await this.getOwned(id, authorId);
    if (post.status !== GalleryStatus.DRAFT) {
      throw new BadRequestException('仅草稿状态可编辑草稿');
    }
    const data: Prisma.gallery_postsUncheckedUpdateInput = { ...dto };
    if (dto.mediaUrls !== undefined || dto.coverImage !== undefined) {
      const sourceType = dto.sourceType ?? post.sourceType;
      if (sourceType === 'FROM_GENERATION') {
        data.mediaUrls = [];
        data.coverImage = null;
      } else {
        await this.validateInStationMedia(dto.mediaUrls ?? [], dto.coverImage);
      }
    }
    return this.repo.update(id, data);
  }

  /**
   * POST /gallery/:id/submit：DRAFT → PENDING，提交时用当前记录字段跑 assertSource。
   * 与 createSubmission 一致：FROM_GENERATION 在提交时从服务端生成记录快照
   * prompt/model/width/height，避免 draft→submit 路径下这些字段留空（Tasks 6/7 会读取）。
   * 草稿无持久化的 allowPublicReference，故 referenceImage 走保守分支——仅当参考图本身
   * 已是站内公开可复用资源时才快照（不认用户 flag），否则 null。
   */
  async submitDraft(authorId: string, id: string) {
    const post = await this.getOwned(id, authorId);
    assertTransition(post.status, GalleryStatus.PENDING, 'author');
    assertSource(toSourcePayload(post), 'author');
    const generation = await this.assertOwnership(
      {
        sourceType: post.sourceType,
        imageGenerationId: post.imageGenerationId,
        videoGenerationId: post.videoGenerationId,
      },
      authorId,
    );
    const snapshot = await this.buildGenerationSnapshot(generation, authorId, undefined);
    // Task 4.6：DRAFT→PENDING 是内容变公开的强制点。无论草稿里存了什么，都在此重新
    // 派生（FROM_GENERATION）/ 重新校验 host（USER_UPLOAD），杜绝草稿携带外链后蒙混过审。
    const media = await this.resolveSubmissionMedia(
      post.sourceType,
      { mediaUrls: post.mediaUrls, coverImage: post.coverImage },
      generation,
    );
    return this.repo.update(id, {
      status: GalleryStatus.PENDING,
      mediaUrls: media.mediaUrls,
      coverImage: media.coverImage ?? null,
      ...this.metadataFields(snapshot),
    });
  }

  /**
   * PATCH /gallery/:id：作者本人可编辑基础字段（不改 kind；status 不接受调用方指定 ——
   * UpdateGalleryPostDto 本就不含 status 字段）。
   * C1 修复（先审后发不可绕过）：
   *   (a) 用"当前记录字段 + 本次 dto 覆盖"合并出的来源字段重新跑 assertSource；
   *   (b) 若编辑前状态是 PUBLISHED/HIDDEN，则打回 PENDING 重新进入审核队列，
   *       并清空 publishedAt/reviewedById/reviewedAt；
   *   (c) DRAFT/PENDING/REJECTED 编辑后保持原状态，仍在发布前审核车道内。
   */
  async updatePost(authorId: string, id: string, dto: UpdateGalleryPostDto) {
    const post = await this.getOwned(id, authorId);

    const merged: GallerySourcePayload = {
      kind: post.kind as GallerySourcePayload['kind'],
      sourceType: (dto.sourceType ?? post.sourceType) as GallerySourcePayload['sourceType'],
      mediaUrls: dto.mediaUrls ?? post.mediaUrls,
      imageTemplateId: dto.imageTemplateId ?? post.imageTemplateId,
      videoTemplateId: dto.videoTemplateId ?? post.videoTemplateId,
      imageGenerationId: dto.imageGenerationId ?? post.imageGenerationId,
      videoGenerationId: dto.videoGenerationId ?? post.videoGenerationId,
    };
    assertSource(merged, 'author');
    const generation = await this.assertOwnership(merged, authorId);

    const data: Prisma.gallery_postsUncheckedUpdateInput = { ...dto };
    // 仅当本次编辑真正改动了来源/生成引用时才重新快照，避免编辑无关字段（如仅改标题）时
    // 把 createSubmission 时经 allowPublicReference===true 授权写入的 referenceImage 静默清空。
    // referenceImage 走保守分支（不认用户 flag，显式授权仅存在于直接 createSubmission）。
    const sourceRefChanged =
      (dto.sourceType !== undefined && dto.sourceType !== post.sourceType) ||
      (dto.imageGenerationId !== undefined && dto.imageGenerationId !== post.imageGenerationId) ||
      (dto.videoGenerationId !== undefined && dto.videoGenerationId !== post.videoGenerationId);
    if (sourceRefChanged) {
      const snapshot = await this.buildGenerationSnapshot(generation, authorId, undefined);
      Object.assign(data, this.metadataFields(snapshot));
    }

    // Task 4.6：一次请求把 mediaUrls/coverImage 换成 evil.com 必须被拦。
    // FROM_GENERATION：媒体只能来自生成记录（来源/生成引用变动或本次带媒体时重新派生，
    // 覆盖 {...dto} 里可能夹带的外链）；其余来源：本次带媒体则强制校验 host。
    const mediaProvided = dto.mediaUrls !== undefined || dto.coverImage !== undefined;
    if (merged.sourceType === 'FROM_GENERATION') {
      if (mediaProvided || sourceRefChanged) {
        const derived = deriveGenerationMediaUrls({ generatedImages: generation?.mediaUrls });
        if (!derived) {
          throw new BadRequestException('生成结果为空，无法更新媒体');
        }
        data.mediaUrls = derived.mediaUrls;
        data.coverImage = derived.coverImage;
      }
    } else if (mediaProvided) {
      await this.validateInStationMedia(dto.mediaUrls ?? [], dto.coverImage);
    }
    if (post.status === GalleryStatus.PUBLISHED || post.status === GalleryStatus.HIDDEN) {
      data.status = GalleryStatus.PENDING;
      data.publishedAt = null;
      data.reviewedById = null;
      data.reviewedAt = null;
    }
    return this.repo.update(id, data);
  }

  /** DELETE /gallery/:id：作者本人 → REMOVED；非法转移/非作者由 assertTransition/getOwned 抛错。 */
  async removePost(authorId: string, id: string) {
    const post = await this.getOwned(id, authorId);
    assertTransition(post.status, GalleryStatus.REMOVED, 'author');
    return this.repo.update(id, { status: GalleryStatus.REMOVED });
  }

  /** POST /gallery/:id/unpublish：作者本人自行下架已发布作品，PUBLISHED → UNPUBLISHED。 */
  async unpublish(authorId: string, id: string) {
    const post = await this.getOwned(id, authorId);
    assertTransition(post.status, GalleryStatus.UNPUBLISHED, 'author');
    return this.repo.update(id, { status: GalleryStatus.UNPUBLISHED });
  }

  /**
   * POST /gallery/:id/republish：作者本人把已下架作品重新提交审核，UNPUBLISHED → PENDING。
   * 仅接受 UNPUBLISHED；HIDDEN（管理员处罚下架）不在状态机内 → assertTransition 直接 400，
   * 防止作者绕开处罚自行"重新发布"。
   */
  async republish(authorId: string, id: string) {
    const post = await this.getOwned(id, authorId);
    assertTransition(post.status, GalleryStatus.PENDING, 'author');
    return this.repo.update(id, { status: GalleryStatus.PENDING });
  }

  /**
   * GET /gallery/feed：公开热度 Feed（首页图片/视频画廊消费）。
   * 只返回 PUBLISHED 作品，按 kind 分流（IMAGE/VIDEO），并附带互动指标（无指标行则补零）。
   */
  async listFeed(kind: string | undefined, cursor: string | undefined, take: number) {
    const normalizedKind =
      String(kind).toUpperCase() === GalleryKind.VIDEO ? GalleryKind.VIDEO : GalleryKind.IMAGE;
    const n = Math.trunc(Number(take));
    const clampedTake = Number.isFinite(n) ? Math.min(Math.max(n, 1), 48) : 24;

    const { items, nextCursor } = await this.repo.findPublishedFeed(
      normalizedKind,
      cursor,
      clampedTake,
    );
    const metricsMap = await this.metrics.getMetricsMap(
      ResourceType.GALLERY_POST,
      items.map((post) => post.id),
    );

    return {
      items: items.map((post) => {
        const m = metricsMap.get(post.id);
        return {
          post,
          metrics: {
            pvCount: m?.pvCount ?? 0,
            uvCount: m?.uvCount ?? 0,
            likeCount: m?.likeCount ?? 0,
            favoriteCount: m?.favoriteCount ?? 0,
            viewCount: m?.viewCount ?? 0,
            referenceCount: m?.referenceCount ?? 0,
          },
        };
      }),
      nextCursor,
    };
  }

  /**
   * GET /gallery/:id 详情聚合（Plan C Task 7）：
   * - 可见性：匿名仅 PUBLISHED；作者本人 / 管理员可预览自己（他人-管理员）的非公开作品，
   *   否则 404（与 getVisible 同规则，不泄漏未公开作品的存在）。
   * - 聚合：作者身份经 presentAuthor（已注销用户隐私脱敏）；指标读 resource_metrics
   *   （view/download/reference/like/favorite）；登录态用批量成员查询算出 viewer.{liked,favorited}。
   * - 双写：登录访问经 interactions.createView 往 resource_views 写一条个人浏览历史；
   *   匿名不写、viewer 省略（telemetry resource_view_events 是另一条并行链路，与此无关）。
   */
  async getDetail(id: string, viewer: AuthUser | undefined) {
    const post = await this.repo.findByIdWithAuthor(id);
    if (!post) throw new NotFoundException('作品不存在');
    if (post.status !== GalleryStatus.PUBLISHED) {
      const isOwner = !!viewer && post.authorId === viewer.id;
      if (!isOwner && !isAdminUser(viewer)) {
        throw new NotFoundException('作品不存在');
      }
    }

    // displayName←realName now; ←nickname??realName after account branch merges.
    const author: PresentedAuthor = presentAuthor({
      id: post.author.id,
      status: post.author.status,
      displayName: post.author.realName ?? null,
      username: post.author.username,
      avatar: post.author.avatar ?? null,
    });

    const m = await this.metrics.getMetrics(ResourceType.GALLERY_POST, id);
    const metrics = {
      pvCount: m.pvCount,
      uvCount: m.uvCount,
      viewCount: m.viewCount,
      downloadCount: m.downloadCount,
      referenceCount: m.referenceCount,
      likeCount: m.likeCount,
      favoriteCount: m.favoriteCount,
    };

    if (!viewer) {
      // 匿名：不写个人历史、不返回 viewer 态。
      return { post, author, metrics };
    }

    // 登录态：批量成员查询（单条也传 [id]，Task 8 feed 直接复用同一批量方法，杜绝 N+1）。
    const [likedIds, favoritedIds] = await Promise.all([
      this.interactions!.findLikedIds(viewer.id, ResourceType.GALLERY_POST, [id]),
      this.interactions!.findFavoritedIds(viewer.id, ResourceType.GALLERY_POST, [id]),
    ]);
    // 双写 resource_views（个人浏览历史来源）。
    await this.interactions!.createView(viewer.id, ResourceType.GALLERY_POST, id);

    return {
      post,
      author,
      metrics,
      viewer: { liked: likedIds.has(id), favorited: favoritedIds.has(id) },
    };
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

  /**
   * M2：点赞/收藏前校验目标作品存在且已发布，避免在 DRAFT/HIDDEN/REMOVED/不存在的 id 上
   * 留下孤立指标行。Plan C Task 5：download 复用同一条"仅 PUBLISHED"校验，故返回命中的
   * post（download 还需要它的 mediaUrls/coverImage 派生下载 URL，避免重复查库）。
   */
  private async assertLikeableOrFavoritable(id: string) {
    const post = await this.repo.findById(id);
    if (!post) throw new NotFoundException('作品不存在');
    if (post.status !== GalleryStatus.PUBLISHED) {
      throw new BadRequestException('仅已发布作品可点赞/收藏/下载');
    }
    return post;
  }

  async like(userId: string, id: string) {
    await this.assertLikeableOrFavoritable(id);
    return this.metrics.like(userId, ResourceType.GALLERY_POST, id);
  }

  async favorite(userId: string, id: string) {
    await this.assertLikeableOrFavoritable(id);
    return this.metrics.favorite(userId, ResourceType.GALLERY_POST, id);
  }

  /**
   * POST /gallery/:id/download（Plan C Task 5）：仅已发布作品可下载，与 like/favorite
   * 共用同一条"仅 PUBLISHED"校验（assertLikeableOrFavoritable：404 不存在 / 400 未发布）。
   * 下载不去重——每次调用都同步事务插一条 resource_download_events + 真实 INCR
   * downloadCount（见 resource-metrics.repository.recordDownload），不同于 like/favorite
   * 的幂等切换语义。下载 URL 取站内媒体（mediaUrls[0]，视频/多图取主资源），
   * 缺失时兜底 coverImage。
   */
  async download(userId: string, id: string): Promise<{ downloadUrl: string }> {
    const post = await this.assertLikeableOrFavoritable(id);
    const downloadUrl = post.mediaUrls[0] ?? post.coverImage;
    if (!downloadUrl) {
      throw new NotFoundException('作品暂无可下载资源');
    }
    await this.metrics.recordDownload(ResourceType.GALLERY_POST, id, userId);
    return { downloadUrl };
  }

  /**
   * POST /gallery/:id/recreate（Plan C Task 6）：仅已发布作品可"再创作"，与 like/favorite/
   * download 共用同一条"仅 PUBLISHED"校验（assertLikeableOrFavoritable）。返回值直接读
   * gallery_posts 自身的创作快照（prompt/model/referenceImage）—— 不查 image_generations，
   * 快照就是 Task 4（createSubmission/submitDraft）落库时固化的那份，与生成记录当下状态
   * 无关，即便原生成记录已被删除也不影响 recreate。同时记一次引用事件并 INCR
   * referenceCount（refType 用 'recreate' 标识来源动作，与 recordReference 通用签名一致）。
   * referenceImage 为 null 时不返回该字段（brief："referenceImage 为 null 则不含"）。
   */
  async recreate(
    userId: string,
    id: string,
  ): Promise<{ prompt: string | null; model: string | null; referenceImage?: string }> {
    const post = await this.assertLikeableOrFavoritable(id);
    await this.metrics.recordReference(ResourceType.GALLERY_POST, id, 'recreate', userId);
    return {
      prompt: post.prompt,
      model: post.model,
      ...(post.referenceImage ? { referenceImage: post.referenceImage } : {}),
    };
  }

  // ── 管理端 ──────────────────────────────────────────────────────────

  async listPending(cursor: string | undefined, take: number) {
    return this.repo.findPendingPage(cursor, take);
  }

  /** 管理端按状态分页；status 需为 PENDING/PUBLISHED/HIDDEN/REJECTED 之一，非法值报 400。 */
  async listByStatus(status: string | undefined, cursor: string | undefined, take: number) {
    const allowed = [
      GalleryStatus.PENDING,
      GalleryStatus.PUBLISHED,
      GalleryStatus.HIDDEN,
      GalleryStatus.REJECTED,
    ] as const;
    const normalized = allowed.find((s) => s === status);
    if (!normalized) {
      throw new BadRequestException('status 仅支持 PENDING/PUBLISHED/HIDDEN/REJECTED');
    }
    return this.repo.findByStatusPage(normalized, cursor, take);
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

  /** 管理端：解封被处罚下架的作品，HIDDEN → PUBLISHED。 */
  async unhide(adminId: string, id: string) {
    const post = await this.requirePost(id);
    assertTransition(post.status, GalleryStatus.PUBLISHED, 'admin');
    const updated = await this.repo.update(id, { status: GalleryStatus.PUBLISHED });
    await this.repo.writeAuditLog('gallery.unhide', adminId, {
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
