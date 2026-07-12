import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ResourceType } from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';
import type { MaterialAssetSourceType, MaterialAssetType } from './materials.service';

type Tx = Prisma.TransactionClient;

/** deriveSourceState 的穷举结果：可用 / 已下架(仅 Gallery UNPUBLISHED) / 被拦截(不可公开访问) / 引用已丢失。 */
export type MaterialSourceState = 'available' | 'unpublished' | 'blocked' | 'missing';

/** deriveSourceState 输入的最小形状：只需 id + 溯源三元组，供 materials 表行直接喂入。 */
export interface MaterialSourceRef {
  id: string;
  librarySource: string;
  sourceResourceType: ResourceType | null;
  sourceId: string | null;
}

const TEMPLATE_RESOURCE_TYPES = new Set<ResourceType>([
  ResourceType.IMAGE_TEMPLATE,
  ResourceType.VIDEO_TEMPLATE,
]);

interface ResourceSnapshot {
  type: MaterialAssetType;
  sourceType: MaterialAssetSourceType;
  title: string;
  url: string | null;
  thumbnailUrl: string | null;
}

/**
 * Plan C Task 10：收藏耦合 + 素材删除的收藏联动 + sourceState 拦截，统一入口。
 *
 * 设计要点（详见 task-10-brief）：
 * - favorite/unfavorite 在单个 $transaction 内同时驱动 resource_favorites +
 *   resource_metrics.favoriteCount + material_assets(librarySource=FAVORITE)：
 *   前二者的计数只在"真正发生了一次新插入/删除"（count===1）时才 +1/-1，
 *   避免并发重复请求重复计数；FAVORITE 素材行硬删除，不软删、不复活。
 * - deleteMaterial(s)/deleteFolder/purgeUser 对 librarySource=FAVORITE 的素材联动走
 *   unfavorite 的删除+计数逻辑（取消收藏）；UPLOAD/HISTORY 素材保持软删除，不触碰收藏。
 * - deriveSourceState 批量把素材背后引用的 Gallery/模板资源状态穷举映射成
 *   available/unpublished/blocked/missing，供 assertUsable 在 use/download 前拦截。
 *
 * purgeUser 是为账户清理准备的可复用入口——本分支没有账户注销/匿名化流程
 * （auth-identity.repository 只有 OAuth 解绑），wiring 到账户清理延后到账户分支合并时接入。
 */
@Injectable()
export class FavoriteLibraryService {
  constructor(private readonly prisma: PrismaService) {}

  // ── 收藏 / 取消收藏（单事务） ──────────────────────────────────────────

  async favorite(userId: string, resourceType: ResourceType, resourceId: string) {
    return this.prisma.$transaction(async (tx) => {
      const snapshot = await this.resolveResourceSnapshot(tx, resourceType, resourceId);
      if (!snapshot) throw new NotFoundException('资源不存在');

      const { count } = await tx.resource_favorites.createMany({
        data: [{ userId, resourceType, resourceId }],
        skipDuplicates: true,
      });
      if (count === 1) {
        await this.bumpFavoriteCount(tx, resourceType, resourceId, 1);
      }

      await this.createFavoriteMaterial(tx, userId, resourceType, resourceId, snapshot);
      return { favorited: true };
    });
  }

  async unfavorite(userId: string, resourceType: ResourceType, resourceId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.removeFavoriteInTx(tx, userId, resourceType, resourceId);
      return { favorited: false };
    });
  }

  /** favorite() 与 deleteMaterial(s) 联动共用的"取消收藏"落地：deleteMany→count-gated 计数→硬删素材。 */
  private async removeFavoriteInTx(
    tx: Tx,
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
  ) {
    const { count } = await tx.resource_favorites.deleteMany({
      where: { userId, resourceType, resourceId },
    });
    if (count === 1) {
      await this.bumpFavoriteCount(tx, resourceType, resourceId, -1);
    }
    await tx.material_assets.deleteMany({
      where: {
        userId,
        librarySource: 'FAVORITE',
        sourceResourceType: resourceType,
        sourceId: resourceId,
      },
    });
  }

  private async createFavoriteMaterial(
    tx: Tx,
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
    snapshot: ResourceSnapshot,
  ) {
    try {
      await tx.material_assets.create({
        data: {
          userId,
          type: snapshot.type,
          title: snapshot.title,
          url: snapshot.url,
          thumbnailUrl: snapshot.thumbnailUrl,
          sourceType: snapshot.sourceType,
          librarySource: 'FAVORITE',
          sourceResourceType: resourceType,
          sourceId: resourceId,
          tags: [],
          folderId: null,
        },
      });
    } catch (err) {
      // @@unique([userId, librarySource, sourceResourceType, sourceId]) 冲突 = 已存在，幂等跳过。
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return;
      }
      throw err;
    }
  }

  /** 读取被收藏资源的展示快照（type/title/url/thumbnailUrl），用于落 FAVORITE material 行。 */
  private async resolveResourceSnapshot(
    tx: Tx,
    resourceType: ResourceType,
    resourceId: string,
  ): Promise<ResourceSnapshot | null> {
    switch (resourceType) {
      case ResourceType.GALLERY_POST: {
        const post = await tx.gallery_posts.findUnique({ where: { id: resourceId } });
        if (!post) return null;
        const isVideo = post.kind === 'VIDEO';
        return {
          type: isVideo ? 'video' : 'image',
          sourceType: isVideo ? 'video_generation' : 'image_generation',
          title: post.title ?? `作品 ${resourceId.slice(0, 8)}`,
          url: post.mediaUrls[0] ?? post.coverImage ?? null,
          thumbnailUrl: post.coverImage ?? null,
        };
      }
      case ResourceType.IMAGE_TEMPLATE: {
        const tpl = await tx.image_templates.findUnique({ where: { id: resourceId } });
        if (!tpl) return null;
        return {
          type: 'image',
          sourceType: 'image_generation',
          title: tpl.title,
          url: tpl.coverImage ?? tpl.exampleImages[0] ?? null,
          thumbnailUrl: tpl.coverImage ?? null,
        };
      }
      case ResourceType.VIDEO_TEMPLATE: {
        const tpl = await tx.video_templates.findUnique({ where: { id: resourceId } });
        if (!tpl) return null;
        return {
          type: 'video',
          sourceType: 'video_generation',
          title: tpl.title,
          url: tpl.coverImage ?? tpl.exampleMedia[0] ?? null,
          thumbnailUrl: tpl.coverImage ?? null,
        };
      }
      default:
        // SKILL/MCP/AGENT 走 base-resource.service 自有的点赞/收藏，不产生素材库条目。
        return null;
    }
  }

  /**
   * INCR/DECR resource_metrics.favoriteCount。increment 用 upsert（首次收藏时行可能不存在）；
   * decrement 用 updateMany（无行时 no-op，不抛错）。不需要 resource-metrics.repository 那种
   * raw SQL GREATEST 地板保护——这里的 -1 严格只在"本事务内确实刚删掉了一行 resource_favorites"
   * (count===1) 时才触发，天然配对，不会被并发路径独立驱动到负数。
   */
  private async bumpFavoriteCount(
    tx: Tx,
    resourceType: ResourceType,
    resourceId: string,
    delta: 1 | -1,
  ) {
    const now = new Date();
    if (delta > 0) {
      await tx.resource_metrics.upsert({
        where: { resourceType_resourceId: { resourceType, resourceId } },
        create: { resourceType, resourceId, favoriteCount: 1, lastActivityAt: now },
        update: { favoriteCount: { increment: 1 }, lastActivityAt: now },
      });
      return;
    }
    await tx.resource_metrics.updateMany({
      where: { resourceType, resourceId },
      data: { favoriteCount: { decrement: 1 }, lastActivityAt: now },
    });
  }

  // ── 删除联动：FAVORITE 取消收藏 / UPLOAD·HISTORY 软删 ────────────────────

  async deleteMaterial(userId: string, materialId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const material = await tx.material_assets.findFirst({
        where: { id: materialId, userId, deletedAt: null },
      });
      if (!material) throw new NotFoundException('素材不存在');
      await this.deleteMaterialsInTx(tx, userId, [material]);
    });
  }

  async deleteMaterials(userId: string, ids: string[]): Promise<{ count: number }> {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (uniqueIds.length === 0) return { count: 0 };
    return this.prisma.$transaction(async (tx) => {
      const materials = await tx.material_assets.findMany({
        where: { userId, id: { in: uniqueIds }, deletedAt: null },
      });
      await this.deleteMaterialsInTx(tx, userId, materials);
      return { count: materials.length };
    });
  }

  async deleteFolder(userId: string, folderId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const materials = await tx.material_assets.findMany({
        where: { userId, folderId, deletedAt: null },
      });
      await this.deleteMaterialsInTx(tx, userId, materials);
      await tx.material_folders.update({
        where: { id: folderId },
        data: { deletedAt: new Date() },
      });
    });
  }

  /**
   * 账户清理统一入口：删该用户全部素材（FAVORITE 取消收藏联动 + UPLOAD/HISTORY 软删）。
   * 本分支没有账户注销/匿名化调用方（见文件头注释），此方法是为账户分支合并时接入准备的
   * 完整、可测试、可复用实现——目前没有生产调用点。
   */
  async purgeUser(userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const materials = await tx.material_assets.findMany({
        where: { userId, deletedAt: null },
      });
      await this.deleteMaterialsInTx(tx, userId, materials);
    });
  }

  private async deleteMaterialsInTx(
    tx: Tx,
    userId: string,
    materials: Array<{
      id: string;
      librarySource: string;
      sourceResourceType: ResourceType | null;
      sourceId: string | null;
    }>,
  ) {
    const now = new Date();
    const favorites = materials.filter((m) => m.librarySource === 'FAVORITE');
    const others = materials.filter((m) => m.librarySource !== 'FAVORITE');

    if (others.length > 0) {
      await tx.material_assets.updateMany({
        where: { id: { in: others.map((m) => m.id) } },
        data: { deletedAt: now },
      });
    }

    for (const fav of favorites) {
      if (!fav.sourceResourceType || !fav.sourceId) {
        // 防御性兜底：理论上 FAVORITE 行必有溯源三元组；缺失时按普通素材硬删，避免留孤行。
        await tx.material_assets.delete({ where: { id: fav.id } });
        continue;
      }
      await this.removeFavoriteInTx(tx, userId, fav.sourceResourceType, fav.sourceId);
    }
  }

  // ── sourceState 穷举 + 使用/下载前拦截 ──────────────────────────────────

  /**
   * 批量推导素材背后引用资源的可用性状态。UPLOAD 素材（或任何缺失溯源三元组的行）视为
   * 'available'——它们本就不引用外部资源，没有"来源失效"这回事。
   */
  async deriveSourceState(items: MaterialSourceRef[]): Promise<Map<string, MaterialSourceState>> {
    const result = new Map<string, MaterialSourceState>();
    const galleryIds: string[] = [];
    const imageTemplateIds: string[] = [];
    const videoTemplateIds: string[] = [];

    for (const item of items) {
      if (!item.sourceResourceType || !item.sourceId) {
        result.set(item.id, 'available');
        continue;
      }
      switch (item.sourceResourceType) {
        case ResourceType.GALLERY_POST:
          galleryIds.push(item.sourceId);
          break;
        case ResourceType.IMAGE_TEMPLATE:
          imageTemplateIds.push(item.sourceId);
          break;
        case ResourceType.VIDEO_TEMPLATE:
          videoTemplateIds.push(item.sourceId);
          break;
        default:
          // SKILL/MCP/AGENT 目前不会出现在素材库溯源里；穷举兜底为 missing 而不是崩溃。
          result.set(item.id, 'missing');
      }
    }

    const [galleryRows, imageRows, videoRows] = await Promise.all([
      galleryIds.length
        ? this.prisma.gallery_posts.findMany({
            where: { id: { in: galleryIds } },
            select: { id: true, status: true },
          })
        : Promise.resolve([]),
      imageTemplateIds.length
        ? this.prisma.image_templates.findMany({
            where: { id: { in: imageTemplateIds } },
            select: { id: true, status: true },
          })
        : Promise.resolve([]),
      videoTemplateIds.length
        ? this.prisma.video_templates.findMany({
            where: { id: { in: videoTemplateIds } },
            select: { id: true, status: true },
          })
        : Promise.resolve([]),
    ]);

    const galleryStatus = new Map<string, string>(
      galleryRows.map((r): [string, string] => [r.id, r.status as string]),
    );
    const imageStatus = new Map<string, string>(
      imageRows.map((r): [string, string] => [r.id, r.status as string]),
    );
    const videoStatus = new Map<string, string>(
      videoRows.map((r): [string, string] => [r.id, r.status as string]),
    );

    for (const item of items) {
      if (result.has(item.id)) continue;
      const resourceType = item.sourceResourceType!;
      const sourceId = item.sourceId!;
      const status =
        resourceType === ResourceType.GALLERY_POST
          ? galleryStatus.get(sourceId)
          : resourceType === ResourceType.IMAGE_TEMPLATE
            ? imageStatus.get(sourceId)
            : videoStatus.get(sourceId);

      if (!status) {
        result.set(item.id, 'missing');
        continue;
      }
      result.set(item.id, this.mapStatusToState(resourceType, status));
    }

    return result;
  }

  /** 穷举映射：Gallery PUBLISHED=available / UNPUBLISHED=unpublished / 其余=blocked；Template APPROVED=available / 其余=blocked。 */
  private mapStatusToState(resourceType: ResourceType, status: string): MaterialSourceState {
    if (resourceType === ResourceType.GALLERY_POST) {
      if (status === 'PUBLISHED') return 'available';
      if (status === 'UNPUBLISHED') return 'unpublished';
      // DRAFT | PENDING | REJECTED | HIDDEN | REMOVED
      return 'blocked';
    }
    // TEMPLATE_RESOURCE_TYPES：IMAGE_TEMPLATE / VIDEO_TEMPLATE
    void TEMPLATE_RESOURCE_TYPES; // 穷举文档标记，见上方常量
    return status === 'APPROVED' ? 'available' : 'blocked';
  }

  /** use/download 前置拦截：blocked/missing → 403；unpublished/available 放行。 */
  async assertUsable(material: MaterialSourceRef): Promise<void> {
    const stateMap = await this.deriveSourceState([material]);
    const state = stateMap.get(material.id);
    if (state === 'blocked' || state === 'missing') {
      throw new ForbiddenException('该素材的来源资源已不可用');
    }
  }
}
