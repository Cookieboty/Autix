import { Module } from '@nestjs/common';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { StorageModule } from '../../platform/storage/storage.module';
// Plan C Task 11：saveFromHistory 复用市场域的浏览记录仓储；该仓储只依赖 PrismaService（叶子
// 仓储），沿用 acquisitions/marketplace 等既有模块的惯例——各自作为 provider 直接持有一份实例，
// 不额外拆专属 module（见 acquisitions.module.ts 对 MarketplaceResourceRepository 的同款用法）。
import { MarketplaceActivityRepository } from '../../marketplace/marketplace-activity.repository';
import { FavoriteLibraryModule } from './favorite-library.module';
import { MaterialsController } from './materials.controller';
import { MaterialsRepository } from './materials.repository';
import { MaterialsService, MATERIAL_FOLDERS_SERVICE } from './materials.service';
import { MaterialFoldersController } from './material-folders.controller';
import { MaterialFoldersRepository } from './material-folders.repository';
import { MaterialFoldersService } from './material-folders.service';

@Module({
  imports: [PrismaModule, StorageModule, FavoriteLibraryModule],
  controllers: [MaterialsController, MaterialFoldersController],
  providers: [
    MaterialsService,
    MaterialsRepository,
    MaterialFoldersService,
    MaterialFoldersRepository,
    MarketplaceActivityRepository,
    { provide: MATERIAL_FOLDERS_SERVICE, useExisting: MaterialFoldersService },
  ],
  exports: [MaterialsService, MaterialFoldersService],
})
export class MaterialsModule {}
