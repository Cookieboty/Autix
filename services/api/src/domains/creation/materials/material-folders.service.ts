import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { MaterialFoldersRepository } from './material-folders.repository';
import { MaterialsService } from './materials.service';

export interface MaterialFolderDto {
  id: string;
  userId: string;
  name: string;
  sortOrder: number;
  assetCount: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class MaterialFoldersService {
  constructor(
    private readonly repository: MaterialFoldersRepository,
    // forwardRef breaks the MaterialsService <-> MaterialFoldersService DI cycle:
    // without it Nest deadlocks resolving the useExisting token alias at boot.
    @Inject(forwardRef(() => MaterialsService))
    private readonly materialsService: MaterialsService,
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
      sortOrder: f.sortOrder,
      assetCount: countByFolder.get(f.id) ?? 0,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    }));
    return { folders: dtos, totalAssetCount, rootAssetCount };
  }

  async create(userId: string, input: { name: string }) {
    await this.materialsService.assertCanAddOrUse(userId);
    const name = this.normalizeName(input.name);
    await this.assertNameAvailable(userId, name);
    return this.repository.create({ userId, name, sortOrder: 0 });
  }

  async update(userId: string, id: string, input: { name?: string; sortOrder?: number }) {
    await this.ensureFolderOwned(userId, id);
    const data: { name?: string; sortOrder?: number } = {};
    if (input.name !== undefined) {
      const name = this.normalizeName(input.name);
      await this.assertNameAvailable(userId, name, id);
      data.name = name;
    }
    if (input.sortOrder !== undefined) {
      data.sortOrder = Number.isFinite(input.sortOrder) ? Math.trunc(input.sortOrder) : 0;
    }
    return this.repository.update(id, data);
  }

  async remove(userId: string, id: string) {
    await this.ensureFolderOwned(userId, id);
    await this.repository.softDeleteWithAssets(userId, id);
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

  private normalizeName(value: string): string {
    const name = String(value ?? '').trim();
    if (!name) throw new BadRequestException('文件夹名称不能为空');
    return name.slice(0, 100);
  }
}
