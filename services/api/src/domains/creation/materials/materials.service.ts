import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../platform/prisma/generated';
import { MembershipService } from '../../billing/membership/membership.service';
import { CloudflareR2Service } from '../../platform/storage/cloudflare-r2.service';
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
    opts: { type?: string; search?: string; page?: number; pageSize?: number; folderId?: string },
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

    return { items, total, page, pageSize, hasMore: skip + items.length < total, entitlement };
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

  async create(userId: string, input: MaterialCreateInput) {
    await this.assertCanAddOrUse(userId);
    await this.foldersService.assertFolderExists(userId, input.folderId ?? null);
    const type = this.normalizeType(input.type);
    const sourceType = this.normalizeSourceType(input.sourceType);
    const title = this.normalizeTitle(input.title);
    const url = input.url?.trim();
    if (!url) throw new BadRequestException('素材 URL 不能为空');

    return this.materialsRepository.create({
      userId,
      type,
      title,
      url,
      thumbnailUrl: input.thumbnailUrl?.trim() || null,
      mimeType: input.mimeType?.trim() || null,
      size: Number.isFinite(input.size ?? null) ? Number(input.size) : null,
      storageKey: input.storageKey?.trim() || null,
      sourceType,
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
    if (input.thumbnailUrl !== undefined) data.thumbnailUrl = input.thumbnailUrl?.trim() || null;
    if (input.tags !== undefined) data.tags = this.normalizeTags(input.tags);
    if (input.metadata !== undefined) {
      data.metadata = (input.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue;
    }
    if (input.folderId !== undefined) {
      await this.foldersService.assertFolderExists(userId, input.folderId);
      data.folder = input.folderId
        ? { connect: { id: input.folderId } }
        : { disconnect: true };
    }
    return this.materialsRepository.update(id, data);
  }

  async remove(userId: string, id: string) {
    await this.ensureOwned(userId, id);
    await this.materialsRepository.softDelete(id);
  }

  async batchRemove(userId: string, ids: string[]) {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (uniqueIds.length === 0) return { count: 0 };
    const result = await this.materialsRepository.softDeleteMany(userId, uniqueIds);
    return { count: result.count };
  }

  async batchMove(userId: string, ids: string[], folderId: string | null) {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (uniqueIds.length === 0) return { count: 0 };
    await this.foldersService.assertFolderExists(userId, folderId);
    const result = await this.materialsRepository.moveMany(userId, uniqueIds, folderId);
    return { count: result.count };
  }

  async useAsset(userId: string, id: string) {
    await this.assertCanAddOrUse(userId);
    return this.ensureOwned(userId, id);
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
