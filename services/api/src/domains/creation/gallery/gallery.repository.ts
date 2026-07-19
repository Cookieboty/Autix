import { Injectable } from '@nestjs/common';
import { Prisma, GalleryKind, GallerySource, GalleryStatus, ResourceType, TemplateStatus } from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';

/** gallery_posts / gallery_reports 的数据访问层。所有状态迁移由 service 层用 assertTransition 校验后再调用这里。 */
@Injectable()
export class GalleryRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.gallery_posts.findUnique({ where: { id } });
  }

  /**
   * Plan C Task 7：详情聚合用——一次取回帖子 + 作者身份字段（供 gallery-author.presenter 展示）。
   * 只 select presenter 需要的字段（displayName←realName 现阶段；status/username/avatar），
   * 不外泄 email/phone 等 PII。account 分支合入后把 realName 换成 nickname ?? realName。
   */
  findByIdWithAuthor(id: string) {
    return this.prisma.gallery_posts.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            status: true,
            nickname: true,
            realName: true,
            username: true,
            avatar: true,
          },
        },
      },
    });
  }

  create(data: Prisma.gallery_postsUncheckedCreateInput) {
    return this.prisma.gallery_posts.create({ data });
  }

  /**
   * 按来源生成记录查「活着的」广场帖 —— 活帖定义全局唯一：status NOT IN (REMOVED, DRAFT)。
   * DRAFT 是私人草稿，本就不是"广场里活着的作品"，不占这个坑——否则 createDraft（不做归属
   * 校验，imageGenerationId 是 DTO 里任意字符串）建的一条草稿就能把这次生成的投稿坑焊死，
   * 导致真正的作者之后 createSubmission 被自己的（或被冒名顶替的）草稿短路甚至撞库 500。
   * 与 DB 的 partial unique index（gallery_posts_image_generation_active_uniq）同一条规则，
   * 两处必须逐字一致，否则服务层放行的写入会被索引拒绝（或反之）。
   */
  findActivePostByImageGenerationId(imageGenerationId: string, authorId: string) {
    return this.prisma.gallery_posts.findFirst({
      where: {
        imageGenerationId,
        authorId,
        status: { notIn: [GalleryStatus.REMOVED, GalleryStatus.DRAFT] },
      },
      select: { id: true, status: true },
    });
  }

  /**
   * 按一组来源生成记录批量查活帖——与 findActivePostByImageGenerationId 同一条规则
   * （status NOT IN (REMOVED, DRAFT)），一次 findMany，供 workbench history 整页回传
   * 提交态使用，杜绝逐条查的 N+1。
   */
  findActivePostsByImageGenerationIds(
    imageGenerationIds: string[],
    authorId: string,
  ): Promise<
    Array<{ id: string; status: GalleryStatus; rejectReason: string | null; imageGenerationId: string | null }>
  > {
    if (imageGenerationIds.length === 0) return Promise.resolve([]);
    return this.prisma.gallery_posts.findMany({
      where: {
        imageGenerationId: { in: imageGenerationIds },
        authorId,
        status: { notIn: [GalleryStatus.REMOVED, GalleryStatus.DRAFT] },
      },
      select: { id: true, status: true, rejectReason: true, imageGenerationId: true },
    });
  }

  /** 同上，按视频生成 id 批量取活帖（video workbench history 用）。 */
  findActivePostsByVideoGenerationIds(
    videoGenerationIds: string[],
    authorId: string,
  ): Promise<
    Array<{ id: string; status: GalleryStatus; rejectReason: string | null; videoGenerationId: string | null }>
  > {
    if (videoGenerationIds.length === 0) return Promise.resolve([]);
    return this.prisma.gallery_posts.findMany({
      where: {
        videoGenerationId: { in: videoGenerationIds },
        authorId,
        status: { notIn: [GalleryStatus.REMOVED, GalleryStatus.DRAFT] },
      },
      select: { id: true, status: true, rejectReason: true, videoGenerationId: true },
    });
  }

  update(id: string, data: Prisma.gallery_postsUncheckedUpdateInput) {
    return this.prisma.gallery_posts.update({ where: { id }, data });
  }

  /**
   * 媒体外链 → R2 迁移 worker 的取件队列：未搬运且未达尝试上限的作品，先到先搬。
   * 命中 @@index([mediaMigrated, mediaMigrationAttempts])。
   *
   * 显式限定 sourceType=ADMIN_CURATED（Fix 3）：这条队列 + publishIfPending 组成的
   * 自动发布闸门此前只靠 mediaMigrated @default(true) 这个巧合撑着——别的写入路径
   * 从不产出 mediaMigrated=false。一旦某天有代码给非管理端投稿回填这个字段，
   * worker 会把它们静默绕过审核发布。把隐含假设写成显式谓词。
   */
  async findPostsPendingMediaMigration(maxAttempts: number, take: number) {
    return this.prisma.gallery_posts.findMany({
      where: {
        mediaMigrated: false,
        mediaMigrationAttempts: { lt: maxAttempts },
        sourceType: GallerySource.ADMIN_CURATED,
      },
      orderBy: { createdAt: 'asc' },
      take,
      // createdAt 供 worker 算随机发布偏移用：publishedAt = min(createdAt + random(5分钟,6小时), now)。
      select: { id: true, coverImage: true, mediaUrls: true, mediaMigrationAttempts: true, createdAt: true },
    });
  }

  /**
   * 媒体搬运成功后发布：仅当作品仍为 PENDING 且 sourceType=ADMIN_CURATED 时生效（Fix 3，
   * 与 findPostsPendingMediaMigration 同一显式谓词——只有这条导入队列产出的 PENDING
   * 才应被这个自动发布闸门处理）。where 即原子条件（而非先读后写），避免与管理员
   * 并发处置竞态 —— 管理员若已 REJECT/REMOVE，count=0，worker 不覆盖其决定。
   *
   * publishedAt 由调用方算好传入（不再自己 `new Date()`）：worker 要把它撒开成
   * createdAt + random(5分钟,6小时) 再夹住 now，这里只负责原子地写库。
   */
  async publishIfPending(id: string, publishedAt: Date): Promise<number> {
    const res = await this.prisma.gallery_posts.updateMany({
      where: { id, status: GalleryStatus.PENDING, sourceType: GallerySource.ADMIN_CURATED },
      data: { status: GalleryStatus.PUBLISHED, publishedAt },
    });
    return res.count;
  }

  /** 待审列表（PENDING，createdAt 升序，游标为上一页最后一条的 id）。 */
  async findPendingPage(cursor: string | undefined, take: number) {
    return this.findByStatusPage(GalleryStatus.PENDING, cursor, take);
  }

  /**
   * 公开热度 Feed：PUBLISHED + kind，publishedAt 倒序（最新发布优先），游标为上一页最后一条的 id。
   * 命中 @@index([status, kind, publishedAt Desc, id Desc])。
   */
  async findPublishedFeed(kind: GalleryKind, cursor: string | undefined, take: number) {
    const rows = await this.prisma.gallery_posts.findMany({
      where: { status: GalleryStatus.PUBLISHED, kind },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      // 作者身份：与 findByIdWithAuthor 同一份 select（只取 presenter 需要的字段，
      // 不外泄 email/phone 等 PII）。service 会经 presentAuthor 脱敏后再对外暴露。
      include: {
        author: {
          select: {
            id: true,
            status: true,
            nickname: true,
            realName: true,
            username: true,
            avatar: true,
          },
        },
      },
    });
    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
    };
  }

  /**
   * 作者个人页 Generations feed：某作者的 PUBLISHED 作品，image+video 混排（不按 kind 分流），
   * publishedAt 倒序，游标为上一页最后一条 id。命中 @@index([authorId])。
   * author include 与 findPublishedFeed 完全一致，保证 presentFeedRows 能通用。
   */
  async findAuthorPublishedFeed(authorId: string, cursor: string | undefined, take: number) {
    const rows = await this.prisma.gallery_posts.findMany({
      where: { status: GalleryStatus.PUBLISHED, authorId },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        author: {
          select: {
            id: true,
            status: true,
            nickname: true,
            realName: true,
            username: true,
            avatar: true,
          },
        },
      },
    });
    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
    };
  }

  /**
   * 作者个人页左侧统计：作品数 + 全部 PUBLISHED 作品的 view/like 之和。
   *
   * viewCount/likeCount 不在 gallery_posts 上，而在 resource_metrics（resourceType=GALLERY_POST）。
   * 两步：先取作者 PUBLISHED 作品的 id 集，再对 resource_metrics 按这批 id 聚合求和。
   * 作品数直接等于 id 集大小（无需再 count）。作者无作品时全部返回 0。
   */
  async aggregateAuthorMetrics(
    authorId: string,
  ): Promise<{ viewCount: number; likeCount: number; generationCount: number }> {
    const posts = await this.prisma.gallery_posts.findMany({
      where: { status: GalleryStatus.PUBLISHED, authorId },
      select: { id: true },
    });
    const ids = posts.map((p) => p.id);
    if (ids.length === 0) return { viewCount: 0, likeCount: 0, generationCount: 0 };

    const agg = await this.prisma.resource_metrics.aggregate({
      where: { resourceType: ResourceType.GALLERY_POST, resourceId: { in: ids } },
      _sum: { viewCount: true, likeCount: true },
    });
    return {
      viewCount: agg._sum.viewCount ?? 0,
      likeCount: agg._sum.likeCount ?? 0,
      generationCount: ids.length,
    };
  }

  /** 管理端页码分页 + 筛选：返回当前页 items 与匹配总数（同一 where）。 */
  async findAdminPage(where: Prisma.gallery_postsWhereInput, page: number, pageSize: number) {
    const [items, total] = await Promise.all([
      this.prisma.gallery_posts.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        // 审核列表要显示作者（与 feed / 详情同一份 select，同样经 presentAuthor 脱敏）
        include: {
          author: {
            select: {
              id: true,
              status: true,
              nickname: true,
              realName: true,
              username: true,
              avatar: true,
            },
          },
        },
      }),
      this.prisma.gallery_posts.count({ where }),
    ]);
    return { items, total };
  }

  /**
   * 厂商模型串 → 展示别名（model_configs.model → model_configs.name）。
   *
   * gallery_posts.model 存的是厂商串（`doubao-seedream-4-5`），展示要的是运营配的别名
   * （`Seedream 4.5`）。同一个厂商串可能对应多条配置（库里 `gpt-image-2` 就有两条），
   * 所以按「启用优先、最近更新优先」取一条，保证同一串每次解析出同一个名字，
   * 而不是随 Prisma 返回顺序漂。
   *
   * 整页一次批量查（不逐条），与 feed 的 metrics/liked 批量查同源。
   */
  async findModelDisplayNames(models: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(models.filter((m): m is string => !!m))];
    if (unique.length === 0) return new Map();
    const rows = await this.prisma.model_configs.findMany({
      where: { model: { in: unique } },
      select: { model: true, name: true },
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
    });
    const map = new Map<string, string>();
    for (const row of rows) if (!map.has(row.model)) map.set(row.model, row.name);
    return map;
  }

  /** 管理端分类下拉：现存作品去重后的 category 列表（排除空串与已删除）。 */
  async listDistinctCategories(): Promise<string[]> {
    const rows = await this.prisma.gallery_posts.findMany({
      where: { category: { not: '' }, status: { not: GalleryStatus.REMOVED } },
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    });
    return rows.map((row) => row.category).filter(Boolean);
  }

  /** 按状态分页（createdAt 升序，游标为上一页最后一条的 id）。管理端待审/已审列表复用。 */
  async findByStatusPage(status: GalleryStatus, cursor: string | undefined, take: number) {
    const rows = await this.prisma.gallery_posts.findMany({
      where: { status },
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

  /**
   * 归属校验 + 元数据快照共用的查询：一次查询同时拿到 userId（归属判定）与
   * resolvedPrompt/modelUsed/width/height/referenceImage（快照来源），避免重复查库。
   */
  findImageGenerationOwner(id: string) {
    return this.prisma.image_generations.findUnique({
      where: { id },
      select: {
        userId: true,
        resolvedPrompt: true,
        modelUsed: true,
        width: true,
        height: true,
        referenceImage: true,
        // Task 4.5：FROM_GENERATION 投稿的 mediaUrls 从这里派生，不采信 DTO。
        generatedImages: true,
      },
    });
  }

  findVideoGenerationOwner(id: string) {
    return this.prisma.video_generations.findUnique({
      where: { id },
      select: {
        userId: true,
        resolvedPrompt: true,
        modelUsed: true,
        referenceImage: true,
        // Task 4.5：FROM_GENERATION 投稿的 mediaUrls 从这里派生，不采信 DTO。
        generatedVideos: true,
      },
    });
  }

  /**
   * 参考图授权判定用：参考图 URL 是否命中"公开可复用站内资源"——
   * 用户自有素材 / 已发布(PUBLISHED)画廊作品 / 已通过(APPROVED)模板 三者之一即视为可复用。
   * 均为按 URL 精确匹配的直接查询（非模糊启发式）；未命中任何一项时由调用方按 allowPublicReference 兜底。
   */
  async isReferenceImagePubliclyReusable(url: string, authorId: string): Promise<boolean> {
    const [ownMaterial, publishedPost, approvedTemplate] = await Promise.all([
      this.prisma.material_assets.findFirst({
        where: {
          userId: authorId,
          deletedAt: null,
          OR: [{ url }, { thumbnailUrl: url }],
        },
        select: { id: true },
      }),
      this.prisma.gallery_posts.findFirst({
        where: {
          status: GalleryStatus.PUBLISHED,
          OR: [{ coverImage: url }, { mediaUrls: { has: url } }],
        },
        select: { id: true },
      }),
      this.prisma.image_templates.findFirst({
        where: {
          status: TemplateStatus.APPROVED,
          OR: [{ coverImage: url }, { exampleImages: { has: url } }],
        },
        select: { id: true },
      }),
    ]);
    return !!(ownMaterial || publishedPost || approvedTemplate);
  }

  /**
   * Plan C Task 9：管理端 REMOVE 与"归档其转换出的图片模板"必须原子——同一事务内
   * 先把作品 status→REMOVED，再把 sourceGalleryPostId 命中该作品的 image_templates
   * 批量 status→ARCHIVED（已是 ARCHIVED 的跳过，避免无意义写）。没有关联模板时
   * updateMany 影响 0 行，语义上等价于普通 remove。仅此路径触发归档——author 自行
   * unpublish（PUBLISHED→UNPUBLISHED）不经过这里，不会归档任何模板。
   */
  removeAndArchiveTemplate(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.gallery_posts.update({
        where: { id },
        data: { status: GalleryStatus.REMOVED },
      });
      await tx.image_templates.updateMany({
        where: { sourceGalleryPostId: id, status: { not: TemplateStatus.ARCHIVED } },
        data: { status: TemplateStatus.ARCHIVED },
      });
      return updated;
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
