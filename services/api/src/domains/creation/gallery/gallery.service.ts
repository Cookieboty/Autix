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
import { FavoriteLibraryService } from '../materials/favorite-library.service';
import { GalleryRepository } from './gallery.repository';
import { firstNonBlank, presentAuthor, type PresentedAuthor } from './gallery-author.presenter';
import { runWithConcurrency } from './run-with-concurrency';
import type { BatchModerateGalleryDto } from './dto/batch-moderate.dto';
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
    // Plan C Task 10：favorite/unfavorite 改走 FavoriteLibraryService（单事务收藏耦合）。
    // 同上，可选只是为了不动既有不测 favorite/unfavorite 的构造点；生产环境恒注入。
    private readonly favoriteLibrary?: FavoriteLibraryService,
  ) {}

  /** 管理端广场列表：页码分页 + 筛选（kind/category/sourceType/标题搜索/仅非我域名/搬运失败），返回 total。 */
  async listAdminPage(rawQuery: Record<string, unknown>) {
    const q = normalizeAdminGalleryQuery(rawQuery);
    const r2Base = q.externalOnly ? (await this.r2.getPublicBaseUrl()) || null : null;
    const where = buildAdminGalleryWhere(q, r2Base);
    const { items, total } = await this.repo.findAdminPage(where, q.page, q.pageSize);
    return {
      // 同 feed：剥离原始 author 关系行，只暴露 presentAuthor 的脱敏结果
      items: items.map((row) => {
        const { author: _rawAuthor, ...post } = row;
        return {
          ...post,
          author: presentAuthor({
            id: row.author.id,
            status: row.author.status,
            displayName: firstNonBlank(row.author.nickname, row.author.realName),
            username: row.author.username,
            avatar: row.author.avatar ?? null,
          }),
        };
      }),
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
   *
   * 幂等：一次生成至多一条活着的广场帖（status <> REMOVED）。已有活帖 → 直接返回该帖，
   * 不新建。理由：FROM_GENERATION 的媒体是从生成记录派生的整次生成全部图，按「每张图」
   * 重复投稿只会产出内容完全相同的重复帖；且「下架后再投稿」若放行，会绕开 republish
   * 让同一次生成在广场里有两条命。
   */
  async createSubmission(authorId: string, dto: CreateGalleryPostDto) {
    assertSource(dto as GallerySourcePayload, 'author');
    const generation = await this.assertOwnership(dto, authorId);

    if (dto.imageGenerationId) {
      const existing = await this.repo.findActivePostByImageGenerationId(
        dto.imageGenerationId,
        authorId,
      );
      if (existing) return existing;
    }

    const snapshot = await this.buildGenerationSnapshot(
      generation,
      authorId,
      dto.allowPublicReference,
    );
    const media = await this.resolveSubmissionMedia(dto.sourceType, dto, generation);

    const data = {
      kind: dto.kind,
      title: dto.title,
      description: dto.description,
      // 分类可缺省（一键发布不带）：落 ''，审核员在管理端补；与 submitDraft 同一处理
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
      prompt: snapshot?.prompt,
      model: snapshot?.model,
      width: snapshot?.width,
      height: snapshot?.height,
      referenceImage: snapshot?.referenceImage ?? null,
      status: GalleryStatus.PENDING,
      authorId,
    };

    try {
      return await this.repo.create(data);
    } catch (err) {
      // 并发抢跑：两个请求同时通过上面的 findActive 检查，DB partial unique index 是唯一性的
      // 最终保证——抢输的一方命中 P2002 后回查，返回抢赢方那条，而不是把异常冒泡成 500。
      if (
        err instanceof Prisma.PrismaClientKnownRequestError ||
        (err as { code?: string })?.code === 'P2002'
      ) {
        if ((err as { code?: string }).code === 'P2002' && dto.imageGenerationId) {
          const raced = await this.repo.findActivePostByImageGenerationId(
            dto.imageGenerationId,
            authorId,
          );
          if (raced) return raced;
        }
      }
      throw err;
    }
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

  /**
   * DELETE /gallery/:id：作者本人 → REMOVED；非法转移/非作者由 assertTransition/getOwned 抛错。
   * 与管理端 remove 走同一条归档路径（removeAndArchiveTemplate）——convertToTemplate 不改动
   * 作品状态，作品仍为 PUBLISHED，作者可自删已转换过的作品，故此处也必须在同事务内把关联
   * 图片模板归档，否则会出现作品 REMOVED 但模板仍 APPROVED、引用已删来源的孤儿状态。
   */
  async removePost(authorId: string, id: string) {
    const post = await this.getOwned(id, authorId);
    assertTransition(post.status, GalleryStatus.REMOVED, 'author');
    return this.repo.removeAndArchiveTemplate(id);
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

  /** 生成记录 id → 该生成当前活着的广场帖（status <> REMOVED, DRAFT）。无活帖的 id 不在 Map 里。 */
  async findActivePostsByGenerationIds(authorId: string, imageGenerationIds: string[]) {
    const posts = await this.repo.findActivePostsByImageGenerationIds(imageGenerationIds, authorId);
    return new Map(
      posts
        .filter((post) => !!post.imageGenerationId)
        .map((post) => [
          post.imageGenerationId as string,
          { id: post.id, status: post.status, rejectReason: post.rejectReason },
        ]),
    );
  }

  /**
   * GET /gallery/feed：公开热度 Feed（首页图片/视频画廊消费）。
   * 只返回 PUBLISHED 作品，按 kind 分流（IMAGE/VIDEO），并附带互动指标（无指标行则补零）。
   * Plan C Task 8：登录态附本页每项的 liked/favorited —— 拿到本页 items 后收集 ids，
   * 各跑一次批量成员查询（findLikedIds/findFavoritedIds，Task 7 已建），逐项 overlay，
   * 不逐条查（防 N+1，与 getDetail 复用同一批量方法）。匿名 viewer 省略、跳过批量查询。
   */
  async listFeed(
    kind: string | undefined,
    cursor: string | undefined,
    take: number,
    viewer?: AuthUser,
  ) {
    const normalizedKind =
      String(kind).toUpperCase() === GalleryKind.VIDEO ? GalleryKind.VIDEO : GalleryKind.IMAGE;
    const n = Math.trunc(Number(take));
    const clampedTake = Number.isFinite(n) ? Math.min(Math.max(n, 1), 48) : 24;

    const { items, nextCursor } = await this.repo.findPublishedFeed(
      normalizedKind,
      cursor,
      clampedTake,
    );
    return { items: await this.presentFeedRows(items, viewer), nextCursor };
  }

  /**
   * `/@username` 个人页 Generations feed：某作者全部 **PUBLISHED** 作品（image+video 混排，
   * 不按 kind 分流），游标翻页。可见性与公开 feed 一致——只出 PUBLISHED，故主态/客态同一份数据。
   * 复用 presentFeedRows，输出结构与公开 feed 逐字段一致（前端 GalleryFeedItem 可直接消费）。
   */
  async listAuthorFeed(
    authorId: string,
    cursor: string | undefined,
    take: number,
    viewer?: AuthUser,
  ) {
    const n = Math.trunc(Number(take));
    const clampedTake = Number.isFinite(n) ? Math.min(Math.max(n, 1), 48) : 24;
    const { items, nextCursor } = await this.repo.findAuthorPublishedFeed(
      authorId,
      cursor,
      clampedTake,
    );
    return { items: await this.presentFeedRows(items, viewer), nextCursor };
  }

  /**
   * feed 行 → 对外响应的统一映射（公开 feed 与作者 feed 共用）：批量取 metrics/模型别名/
   * 登录态 liked-favorited（防 N+1），并经 presentAuthor 脱敏。抽出来是为了让作者 feed
   * 与公开 feed 的响应形状**逐字段对齐**，不各写一份漂移。
   */
  private async presentFeedRows(
    items: Awaited<ReturnType<GalleryRepository['findPublishedFeed']>>['items'],
    viewer?: AuthUser,
  ) {
    const ids = items.map((post) => post.id);
    const [metricsMap, modelNames] = await Promise.all([
      this.metrics.getMetricsMap(ResourceType.GALLERY_POST, ids),
      // 展示用的模型别名（gallery_posts.model 存的是厂商串，不是给人看的）
      this.repo.findModelDisplayNames(items.map((post) => post.model ?? '')),
    ]);

    let likedIds: Set<string> | undefined;
    let favoritedIds: Set<string> | undefined;
    if (viewer && ids.length > 0) {
      [likedIds, favoritedIds] = await Promise.all([
        this.interactions!.findLikedIds(viewer.id, ResourceType.GALLERY_POST, ids),
        this.interactions!.findFavoritedIds(viewer.id, ResourceType.GALLERY_POST, ids),
      ]);
    }

    return items.map((row) => {
      const m = metricsMap.get(row.id);
      const author: PresentedAuthor = presentAuthor({
        id: row.author.id,
        status: row.author.status,
        displayName: firstNonBlank(row.author.nickname, row.author.realName),
        username: row.author.username,
        avatar: row.author.avatar ?? null,
      });
      // 隐私铁律（与 getDetail 同）：剥离 include 进来的原始 author 关系行，只暴露
      // presenter 脱敏结果——否则匿名响应会把原始 username（含 deleted_<id> 前缀）、
      // realName、旧头像一并回传，presentAuthor 形同虚设。
      const { author: _rawAuthor, ...post } = row;
      return {
        // model 原样保留（厂商串，前端不展示但要有）；modelName 是展示用的别名，
        // 解析不到（模型配置被删了）时为 null，前端回退显示 model。
        post: { ...post, modelName: post.model ? modelNames.get(post.model) ?? null : null },
        author,
        metrics: {
          pvCount: m?.pvCount ?? 0,
          uvCount: m?.uvCount ?? 0,
          likeCount: m?.likeCount ?? 0,
          favoriteCount: m?.favoriteCount ?? 0,
          viewCount: m?.viewCount ?? 0,
          referenceCount: m?.referenceCount ?? 0,
        },
        liked: likedIds ? likedIds.has(post.id) : undefined,
        favorited: favoritedIds ? favoritedIds.has(post.id) : undefined,
      };
    });
  }

  /**
   * `/@username` 个人页左侧统计：该作者全部 PUBLISHED 作品的 viewCount / likeCount 之和
   * 与作品数。sum 通过 resource_metrics 聚合（gallery.repository.aggregateAuthorMetrics），
   * 无作品时全部为 0。
   */
  async getAuthorStats(
    authorId: string,
  ): Promise<{ viewCount: number; likeCount: number; generationCount: number }> {
    return this.repo.aggregateAuthorMetrics(authorId);
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

    const author: PresentedAuthor = presentAuthor({
      id: post.author.id,
      status: post.author.status,
      displayName: firstNonBlank(post.author.nickname, post.author.realName),
      username: post.author.username,
      avatar: post.author.avatar ?? null,
    });

    // 隐私铁律：剥离 include 进来的原始 author 关系行，只对外暴露 presenter 脱敏结果。
    // 否则匿名响应会连原始 username（含 deleted_<id>）/ realName / avatar 一并回传，
    // 使 presentAuthor 形同虚设（ResponseInterceptor 不做字段裁剪）。
    const { author: _rawAuthor, ...rawPost } = post;

    // 展示用的模型别名（与 feed 同一口径：model 保留厂商串，modelName 给人看）
    const modelNames = await this.repo.findModelDisplayNames([rawPost.model ?? '']);
    const postSummary = {
      ...rawPost,
      modelName: rawPost.model ? modelNames.get(rawPost.model) ?? null : null,
    };

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
      return { post: postSummary, author, metrics };
    }

    // 登录态：批量成员查询（单条也传 [id]，Task 8 feed 直接复用同一批量方法，杜绝 N+1）。
    const [likedIds, favoritedIds] = await Promise.all([
      this.interactions!.findLikedIds(viewer.id, ResourceType.GALLERY_POST, [id]),
      this.interactions!.findFavoritedIds(viewer.id, ResourceType.GALLERY_POST, [id]),
    ]);
    // 双写 resource_views（个人浏览历史来源）。
    await this.interactions!.createView(viewer.id, ResourceType.GALLERY_POST, id);

    return {
      post: postSummary,
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
    return this.favoriteLibrary!.favorite(userId, ResourceType.GALLERY_POST, id);
  }

  /**
   * Plan C Task 10：取消收藏不复用 assertLikeableOrFavoritable 的"仅 PUBLISHED"门禁——
   * 与此前直接调 metrics.unfavorite 的行为一致，用户应始终能取消自己的收藏，即便作品
   * 之后被下架/隐藏/删除。
   */
  async unfavorite(userId: string, id: string) {
    return this.favoriteLibrary!.unfavorite(userId, ResourceType.GALLERY_POST, id);
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

  /**
   * 管理端移除作品：REMOVED 与"归档其转换出的图片模板"在同一事务内完成（Plan C
   * Task 9，见 GalleryRepository.removeAndArchiveTemplate）——避免出现作品已删
   * 但转换模板仍挂着 APPROVED 的中间状态。
   */
  async remove(adminId: string, id: string) {
    const post = await this.requirePost(id);
    assertTransition(post.status, GalleryStatus.REMOVED, 'admin');
    const updated = await this.repo.removeAndArchiveTemplate(id);
    await this.repo.writeAuditLog('gallery.remove', adminId, {
      targetType: 'gallery_post',
      targetId: id,
    });
    return updated;
  }

  /**
   * 批量审核：逐条尽力执行，能过的都过，失败的单独收集。
   *
   * 刻意复用单条 approve/reject/hide/remove —— 状态机（assertTransition）和审计日志
   * （writeAuditLog）不用重写一份，批量与单条的行为天然一致，不会随时间漂移。
   *
   * 不做全或全无的事务：审核场景里常常只是某条被同事先处理过，
   * 没有理由让这一条把整批都拖回滚。
   *
   * 并发 5：每条要 3 次数据库往返，远程库单程约 347ms，串行 20 条要 ~20s；
   * 并发 5 压到 ~4s。上限 5 是因为 PrismaPg 没设 max、pg.Pool 默认 max: 10，
   * 留一半连接给其余请求，避免打满连接池反而拖垮全站。
   */
  async batchModerate(
    adminId: string,
    dto: BatchModerateGalleryDto,
  ): Promise<{ succeeded: string[]; failed: { id: string; reason: string }[] }> {
    const succeeded: string[] = [];
    const failed: { id: string; reason: string }[] = [];

    await runWithConcurrency(dto.ids, 5, async (id) => {
      try {
        switch (dto.action) {
          case 'approve':
            await this.approve(adminId, id);
            break;
          case 'reject':
            await this.reject(adminId, id, { reason: dto.reason! });
            break;
          case 'hide':
            await this.hide(adminId, id);
            break;
          case 'remove':
            await this.remove(adminId, id);
            break;
        }
        succeeded.push(id);
      } catch (error) {
        // 单条失败只记录原因，不中断其余条目。
        failed.push({
          id,
          reason: error instanceof Error ? error.message : '未知错误',
        });
      }
    });

    return { succeeded, failed };
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
