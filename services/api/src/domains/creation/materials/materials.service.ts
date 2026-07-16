import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ResourceType } from '../../platform/prisma/generated';
import { MembershipService } from '../../billing/membership/membership.service';
import { CloudflareR2Service } from '../../platform/storage/cloudflare-r2.service';
import {
  MarketplaceActivityRepository,
  type HistoryCursor,
} from '../../marketplace/marketplace-activity.repository';
import { assertInStationMediaUrls } from '../gallery/gallery.helpers';
import { FavoriteLibraryService } from './favorite-library.service';
import { MaterialsRepository } from './materials.repository';
// type-only import avoids the circular ESM TDZ at load time; the string injection token handles DI resolution
import type { MaterialFoldersService } from './material-folders.service';

/** Injection token exported so Task-5 module wiring can provide the service without a value import here. */
export const MATERIAL_FOLDERS_SERVICE = 'MATERIAL_FOLDERS_SERVICE';

export type MaterialAssetType = 'image' | 'video' | 'audio' | 'file';
export type MaterialAssetSourceType = 'upload' | 'image_generation' | 'video_generation' | 'external';

const MATERIAL_TYPES = new Set<MaterialAssetType>(['image', 'video', 'audio', 'file']);
const SOURCE_TYPES = new Set<MaterialAssetSourceType>([
  'upload',
  'image_generation',
  'video_generation',
  'external',
]);

export type MaterialLibrarySource = 'UPLOAD' | 'FAVORITE' | 'HISTORY' | 'GENERATION';
const LIBRARY_SOURCES = new Set<MaterialLibrarySource>([
  'UPLOAD',
  'FAVORITE',
  'HISTORY',
  'GENERATION',
]);

/** Plan C Task 11：能落 librarySource=HISTORY 素材的资源类型——只有这三类会被映射进素材库。 */
const HISTORY_MAPPABLE_TYPES = new Set<ResourceType>([
  ResourceType.IMAGE_TEMPLATE,
  ResourceType.VIDEO_TEMPLATE,
  ResourceType.GALLERY_POST,
]);

/**
 * 全部合法 ResourceType（浏览历史覆盖 5 类资源 + Gallery，比 HISTORY_MAPPABLE_TYPES 宽）——
 * 只用于校验分页游标里的 resourceType，防止畸形值被拼进 SQL 的枚举 cast。
 */
const RESOURCE_TYPES = new Set<ResourceType>(Object.values(ResourceType) as ResourceType[]);

export interface MaterialCreateInput {
  type: MaterialAssetType;
  title: string;
  url: string;
  thumbnailUrl?: string | null;
  mimeType?: string | null;
  size?: number | null;
  storageKey?: string | null;
  sourceType: MaterialAssetSourceType;
  sourceId?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown> | null;
  folderId?: string | null;
}

export interface MaterialUpdateInput {
  title?: string;
  thumbnailUrl?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown> | null;
  folderId?: string | null;
}

@Injectable()
export class MaterialsService {
  constructor(
    private readonly materialsRepository: MaterialsRepository,
    private readonly membershipService: MembershipService,
    private readonly r2Service: CloudflareR2Service,
    @Inject(MATERIAL_FOLDERS_SERVICE)
    private readonly foldersService: MaterialFoldersService,
    private readonly favoriteLibrary: FavoriteLibraryService,
    private readonly activityRepository: MarketplaceActivityRepository,
  ) {}

  async getEntitlement(userId: string) {
    const { membership } = await this.membershipService.getUserMembership(userId);
    const active =
      Boolean(membership) &&
      membership!.status === 'ACTIVE' &&
      membership!.expiresAt > new Date() &&
      Number(membership!.level?.level ?? 0) > 0;
    return {
      canAdd: active,
      canUse: active,
      reason: active ? null : '需要有效会员才能新增或使用素材',
      levelName: active ? membership?.level?.name ?? '会员' : null,
      expiresAt: active ? membership?.expiresAt ?? null : null,
    };
  }

  async assertCanAddOrUse(userId: string) {
    const entitlement = await this.getEntitlement(userId);
    if (!entitlement.canUse) {
      throw new ForbiddenException(entitlement.reason ?? '需要有效会员才能使用素材');
    }
    return entitlement;
  }

  async list(
    userId: string,
    opts: {
      type?: string;
      search?: string;
      page?: number;
      pageSize?: number;
      folderId?: string;
      librarySource?: string;
    },
  ) {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(80, Math.max(1, opts.pageSize ?? 30));
    const skip = (page - 1) * pageSize;
    const where: Prisma.material_assetsWhereInput = {
      userId,
      deletedAt: null,
    };
    if (opts.type && opts.type !== 'all') {
      where.type = this.normalizeType(opts.type);
    }
    if (opts.folderId === 'root') {
      where.folderId = null;
    } else if (opts.folderId) {
      where.folderId = opts.folderId;
    }
    if (opts.librarySource) {
      where.librarySource = this.normalizeLibrarySource(opts.librarySource);
    }
    const search = opts.search?.trim();
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { sourceType: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
      ];
    }

    const [[items, total], entitlement] = await Promise.all([
      this.materialsRepository.findMany({ where, skip, pageSize }),
      this.getEntitlement(userId),
    ]);

    // Plan C Task 11：批量推导每个素材背后引用资源的可用性（一次 deriveSourceState 调用，
    // 不逐条查询——见 FavoriteLibraryService.deriveSourceState 的批量实现，避免列表页 N+1）。
    const stateMap = await this.favoriteLibrary.deriveSourceState(items);
    const itemsWithState = items.map((item) => ({
      ...item,
      sourceState: stateMap.get(item.id) ?? 'available',
    }));

    return {
      items: itemsWithState,
      total,
      page,
      pageSize,
      hasMore: skip + items.length < total,
      entitlement,
    };
  }

  /**
   * Plan C Task 11：从浏览历史保存素材。先校验 resourceType 属可映射类型，再校验用户
   * 确有对应 resource_views 记录（防伪造历史保存——不能凭空对没浏览过的资源发起保存），
   * 最后才落 librarySource=HISTORY（幂等由 FavoriteLibraryService.saveHistoryMaterial 兜底）。
   */
  async saveFromHistory(userId: string, resourceType: string, resourceId: string) {
    const normalizedType = resourceType as ResourceType;
    if (!HISTORY_MAPPABLE_TYPES.has(normalizedType)) {
      throw new BadRequestException('该资源类型不支持保存到素材库');
    }
    const trimmedId = String(resourceId ?? '').trim();
    if (!trimmedId) throw new BadRequestException('资源 ID 不能为空');

    const viewed = await this.activityRepository.hasViewed(userId, normalizedType, trimmedId);
    if (!viewed) {
      throw new BadRequestException('未浏览过该资源，无法保存到素材库');
    }

    return this.favoriteLibrary.saveHistoryMaterial(userId, normalizedType, trimmedId);
  }

  /**
   * Plan C Task 11：去重后的浏览历史列表（`GET /materials/history`）——Task 12 前端"从历史
   * 保存到素材库"的数据源。游标是 base64(JSON) 的不透明串，解码后**严格校验**三元组
   * （viewedAt 可解析为合法时间、resourceType 属合法枚举、resourceId 非空字符串），
   * 任何畸形游标一律 400，绝不放行到 SQL 层。
   */
  async listHistory(userId: string, opts: { cursor?: string; take?: number }) {
    // Number('abc') → NaN，且 Math.max(1, NaN) 仍是 NaN——不能让它流到 SQL 的 LIMIT，显式兜底。
    const rawTake = Number(opts.take);
    const take = Number.isFinite(rawTake) ? Math.min(100, Math.max(1, Math.trunc(rawTake))) : 30;
    const cursor = this.decodeHistoryCursor(opts.cursor);
    const { items, nextCursor } = await this.activityRepository.listHistory(userId, cursor, take);
    return { items, nextCursor: nextCursor ? this.encodeHistoryCursor(nextCursor) : null };
  }

  private encodeHistoryCursor(cursor: HistoryCursor): string {
    return Buffer.from(
      JSON.stringify({
        viewedAt: cursor.viewedAt.toISOString(),
        resourceType: cursor.resourceType,
        resourceId: cursor.resourceId,
      }),
      'utf8',
    ).toString('base64url');
  }

  private decodeHistoryCursor(raw?: string): HistoryCursor | undefined {
    const value = String(raw ?? '').trim();
    if (!value) return undefined;

    let parsed: unknown;
    try {
      parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    } catch {
      throw new BadRequestException('分页游标无效');
    }
    if (!parsed || typeof parsed !== 'object') throw new BadRequestException('分页游标无效');

    const { viewedAt, resourceType, resourceId } = parsed as Record<string, unknown>;
    if (typeof viewedAt !== 'string' || typeof resourceId !== 'string' || !resourceId.trim()) {
      throw new BadRequestException('分页游标无效');
    }
    const viewedAtDate = new Date(viewedAt);
    if (Number.isNaN(viewedAtDate.getTime())) throw new BadRequestException('分页游标无效');
    if (
      typeof resourceType !== 'string' ||
      !RESOURCE_TYPES.has(resourceType as ResourceType)
    ) {
      throw new BadRequestException('分页游标无效');
    }

    return {
      viewedAt: viewedAtDate,
      resourceType: resourceType as ResourceType,
      resourceId,
    };
  }

  async createUploadUrl(
    userId: string,
    opts: { fileName: string; contentType: string; folder?: string },
  ) {
    await this.assertCanAddOrUse(userId);
    return this.r2Service.createPresignedUpload({
      fileName: opts.fileName,
      contentType: opts.contentType,
      folder: opts.folder ?? 'amux-studio/materials',
      userId,
    });
  }

  /**
   * Task 4.5 站内来源写入守卫：素材必须来自站内存储（自有 R2 域名），拒绝任意公网 URL 与
   * `sourceType='external'`（该值曾允许直接登记外链素材，是"所有资源来自站内"的一个写入口子）。
   */
  async create(userId: string, input: MaterialCreateInput) {
    await this.assertCanAddOrUse(userId);
    await this.foldersService.assertFolderExists(userId, input.folderId ?? null);
    const type = this.normalizeType(input.type);
    const sourceType = this.normalizeSourceType(input.sourceType);
    if (sourceType === 'external') {
      throw new BadRequestException('不支持 external 来源，素材必须来自站内存储');
    }
    const title = this.normalizeTitle(input.title);
    const url = input.url?.trim();
    if (!url) throw new BadRequestException('素材 URL 不能为空');
    const thumbnailUrl = input.thumbnailUrl?.trim() || null;

    const r2Base = await this.r2Service.getPublicBaseUrl();
    const mediaUrls = thumbnailUrl ? [url, thumbnailUrl] : [url];
    assertInStationMediaUrls(mediaUrls, [r2Base], '素材 URL 必须来自站内存储');

    return this.materialsRepository.create({
      userId,
      type,
      title,
      url,
      thumbnailUrl,
      mimeType: input.mimeType?.trim() || null,
      size: Number.isFinite(input.size ?? null) ? Number(input.size) : null,
      storageKey: input.storageKey?.trim() || null,
      sourceType,
      // 该入口是素材库的手动上传创建，对应新维度 librarySource='UPLOAD'（区别于收藏/历史）。
      librarySource: 'UPLOAD',
      sourceId: input.sourceId?.trim() || null,
      tags: this.normalizeTags(input.tags),
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      folderId: input.folderId ?? null,
    });
  }

  async update(userId: string, id: string, input: MaterialUpdateInput) {
    await this.ensureOwned(userId, id);
    const data: Prisma.material_assetsUpdateInput = {};
    if (input.title !== undefined) data.title = this.normalizeTitle(input.title);
    if (input.thumbnailUrl !== undefined) {
      // Task 4.6：update 也不得把外链缩略图写入（create 已守，update 此前漏守）。
      const thumbnailUrl = input.thumbnailUrl?.trim() || null;
      if (thumbnailUrl) {
        const r2Base = await this.r2Service.getPublicBaseUrl();
        assertInStationMediaUrls([thumbnailUrl], [r2Base], '素材缩略图必须来自站内存储');
      }
      data.thumbnailUrl = thumbnailUrl;
    }
    if (input.tags !== undefined) data.tags = this.normalizeTags(input.tags);
    if (input.metadata !== undefined) {
      data.metadata = (input.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue;
    }
    if (input.folderId !== undefined) {
      await this.foldersService.assertFolderExists(userId, input.folderId);
      await this.assertMoveAllowed(userId, input.folderId);
      data.folder = input.folderId
        ? { connect: { id: input.folderId } }
        : { disconnect: true };
    }
    return this.materialsRepository.update(id, data);
  }

  /** Plan C Task 10：单删走 FavoriteLibraryService——FAVORITE 素材联动取消收藏，UPLOAD/HISTORY 仍软删。 */
  async remove(userId: string, id: string) {
    await this.favoriteLibrary.deleteMaterial(userId, id);
  }

  /** Plan C Task 10：批量删同上，经 FavoriteLibraryService 统一入口。 */
  async batchRemove(userId: string, ids: string[]) {
    return this.favoriteLibrary.deleteMaterials(userId, ids);
  }

  /**
   * Plan C Task 10：会员过期规则——只允许"其他文件夹 → 默认(folderId=null)"，
   * 不允许移入任何具体文件夹（含默认→其他、其他→其他）。folderId=null 恒放行。
   */
  private async assertMoveAllowed(userId: string, targetFolderId: string | null) {
    if (targetFolderId === null) return;
    const entitlement = await this.getEntitlement(userId);
    if (!entitlement.canUse) {
      throw new ForbiddenException('会员已过期，仅可将素材移回默认文件夹');
    }
  }

  async batchMove(userId: string, ids: string[], folderId: string | null) {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (uniqueIds.length === 0) return { count: 0 };
    await this.foldersService.assertFolderExists(userId, folderId);
    await this.assertMoveAllowed(userId, folderId);
    const result = await this.materialsRepository.moveMany(userId, uniqueIds, folderId);
    return { count: result.count };
  }

  async useAsset(userId: string, id: string) {
    await this.assertCanAddOrUse(userId);
    const asset = await this.ensureOwned(userId, id);
    await this.favoriteLibrary.assertUsable(asset);
    return asset;
  }

  /**
   * Plan C Task 10：`POST /materials/:id/download`——sourceState 拦截（blocked/missing → 403），
   * 不复用 useAsset 的会员校验（brief：download 不要求会员，只拦截来源已失效的素材）。
   */
  async download(userId: string, id: string): Promise<{ downloadUrl: string | null }> {
    const asset = await this.ensureOwned(userId, id);
    await this.favoriteLibrary.assertUsable(asset);
    return { downloadUrl: asset.url ?? asset.thumbnailUrl ?? null };
  }

  private async ensureOwned(userId: string, id: string) {
    const asset = await this.materialsRepository.findOwned(userId, id);
    if (!asset) throw new NotFoundException('素材不存在');
    return asset;
  }

  private normalizeType(value: string): MaterialAssetType {
    const type = String(value ?? '').toLowerCase() as MaterialAssetType;
    if (!MATERIAL_TYPES.has(type)) throw new BadRequestException('不支持的素材类型');
    return type;
  }

  private normalizeSourceType(value: string): MaterialAssetSourceType {
    const type = String(value ?? '').toLowerCase() as MaterialAssetSourceType;
    if (!SOURCE_TYPES.has(type)) throw new BadRequestException('不支持的素材来源');
    return type;
  }

  private normalizeLibrarySource(value: string): MaterialLibrarySource {
    const source = String(value ?? '').toUpperCase() as MaterialLibrarySource;
    if (!LIBRARY_SOURCES.has(source)) throw new BadRequestException('不支持的素材库来源筛选');
    return source;
  }

  private normalizeTitle(value: string): string {
    const title = String(value ?? '').trim();
    if (!title) throw new BadRequestException('素材标题不能为空');
    return title.slice(0, 200);
  }

  private normalizeTags(tags?: string[]): string[] {
    if (!Array.isArray(tags)) return [];
    return Array.from(
      new Set(
        tags
          .map((tag) => String(tag ?? '').trim())
          .filter(Boolean)
          .slice(0, 20),
      ),
    );
  }
}
