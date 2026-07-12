import { Module } from '@nestjs/common';
import { MembershipModule } from '../../billing/membership/membership.module';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { StorageModule } from '../../platform/storage/storage.module';
import { FavoriteLibraryModule } from './favorite-library.module';
import { MaterialsController } from './materials.controller';
import { MaterialsRepository } from './materials.repository';
import { MaterialsService, MATERIAL_FOLDERS_SERVICE } from './materials.service';
import { MaterialFoldersController } from './material-folders.controller';
import { MaterialFoldersRepository } from './material-folders.repository';
import { MaterialFoldersService } from './material-folders.service';

@Module({
  imports: [MembershipModule, PrismaModule, StorageModule, FavoriteLibraryModule],
  controllers: [MaterialsController, MaterialFoldersController],
  providers: [
    MaterialsService,
    MaterialsRepository,
    MaterialFoldersService,
    MaterialFoldersRepository,
    { provide: MATERIAL_FOLDERS_SERVICE, useExisting: MaterialFoldersService },
  ],
  exports: [MaterialsService, MaterialFoldersService],
})
export class MaterialsModule {}
