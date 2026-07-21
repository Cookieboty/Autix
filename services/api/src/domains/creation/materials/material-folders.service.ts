import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FavoriteLibraryService } from './favorite-library.service';
import { MaterialFoldersRepository } from './material-folders.repository';

export interface MaterialFolderDto {
  id: string;
  userId: string;
  name: string;
  /** 自定义 emoji 图标；null = 没设过，渲染端回退默认文件夹图形。 */
  icon: string | null;
  sortOrder: number;
  assetCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** material_folders.icon 的列宽（VarChar(16)），按码位计。 */
const ICON_MAX_CODE_POINTS = 16;

@Injectable()
export class MaterialFoldersService {
  constructor(
    private readonly repository: MaterialFoldersRepository,
    private readonly favoriteLibrary: FavoriteLibraryService,
  ) {}

  async listSidebar(userId: string) {
    const [folders, counts] = await Promise.all([
      this.repository.findManyByUser(userId),
      this.repository.countAssetsGroupedByFolder(userId),
    ]);
    const countByFolder = new Map<string, number>();
    let rootAssetCount = 0;
    let totalAssetCount = 0;
    for (const row of counts) {
      totalAssetCount += row.count;
      if (row.folderId === null) rootAssetCount += row.count;
      else countByFolder.set(row.folderId, row.count);
    }
    const dtos: MaterialFolderDto[] = folders.map((f) => ({
      id: f.id,
      userId: f.userId,
      name: f.name,
      icon: f.icon,
      sortOrder: f.sortOrder,
      assetCount: countByFolder.get(f.id) ?? 0,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    }));
    return { folders: dtos, totalAssetCount, rootAssetCount };
  }

  async create(userId: string, input: { name: string; icon?: string | null }) {
    const name = this.normalizeName(input.name);
    await this.assertNameAvailable(userId, name);
    return this.runWithUniqueNameGuard(() =>
      this.repository.create({
        userId,
        name,
        icon: this.normalizeIcon(input.icon),
        sortOrder: 0,
      }),
    );
  }

  async update(
    userId: string,
    id: string,
    input: { name?: string; sortOrder?: number; icon?: string | null },
  ) {
    await this.ensureFolderOwned(userId, id);
    const data: { name?: string; sortOrder?: number; icon?: string | null } = {};
    if (input.name !== undefined) {
      const name = this.normalizeName(input.name);
      await this.assertNameAvailable(userId, name, id);
      data.name = name;
    }
    // 显式传 null = 清除图标；不传 = 不动。二者语义不同，故只看 undefined。
    if (input.icon !== undefined) data.icon = this.normalizeIcon(input.icon);
    if (input.sortOrder !== undefined) {
      data.sortOrder = Number.isFinite(input.sortOrder) ? Math.trunc(input.sortOrder) : 0;
    }
    return this.runWithUniqueNameGuard(() => this.repository.update(id, data));
  }

  /**
   * The pre-check in assertNameAvailable is not atomic; under concurrent creates the
   * DB partial-unique index (userId, lower(name)) is the real backstop. Translate its
   * P2002 violation into the same friendly ConflictException instead of a raw 500.
   */
  private async runWithUniqueNameGuard<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        throw new ConflictException('已存在同名文件夹');
      }
      throw error;
    }
  }

  /** Plan C Task 10：删文件夹经 FavoriteLibraryService——夹内 FAVORITE 素材联动取消收藏，其余仍软删。 */
  async remove(userId: string, id: string) {
    await this.ensureFolderOwned(userId, id);
    await this.favoriteLibrary.deleteFolder(userId, id);
  }

  async ensureFolderOwned(userId: string, id: string) {
    const folder = await this.repository.findOwned(userId, id);
    if (!folder) throw new NotFoundException('文件夹不存在');
    return folder;
  }

  /** 供 MaterialsService 校验 folderId 合法性(null 表示未分类,直接放行)。 */
  async assertFolderExists(userId: string, folderId: string | null | undefined) {
    if (folderId === null || folderId === undefined) return;
    await this.ensureFolderOwned(userId, folderId);
  }

  private async assertNameAvailable(userId: string, name: string, excludeId?: string) {
    const existing = await this.repository.findActiveByName(userId, name);
    if (existing && existing.id !== excludeId) {
      throw new ConflictException('已存在同名文件夹');
    }
  }

  /**
   * emoji 图标入库前的收口。
   *
   * 不做「是不是 emoji」的校验：判定 emoji 需要一张随 Unicode 版本漂移的表，
   * 而风险面很小（自己的文件夹、只回给自己看）。只管长度——列宽 VarChar(16) 是硬约束，
   * 超了 Postgres 直接报错。
   *
   * 按**码位**计数（Array.from）而不是 String.length：后者数的是 UTF-16 码元，
   * 一个 emoji 动辄 2 个码元，会把本来放得下的图标误判成超长。
   */
  private normalizeIcon(value: string | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    if (!text) return null;
    const codePoints = Array.from(text);
    // 放不下就整个拒收，而不是截一半：ZWJ 组合序列（👨‍👩‍👧‍👦 = 7 码位）从中间切开，
    // 得到的是「两个人 + 一个悬空连接符」这种乱码，比没有图标更糟。
    if (codePoints.length > ICON_MAX_CODE_POINTS) {
      throw new BadRequestException('图标不合法');
    }
    return text;
  }

  private normalizeName(value: string): string {
    const name = String(value ?? '').trim();
    if (!name) throw new BadRequestException('文件夹名称不能为空');
    return name.slice(0, 100);
  }
}
