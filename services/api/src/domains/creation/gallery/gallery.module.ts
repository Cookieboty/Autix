import { Module } from '@nestjs/common';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { ResourceMetricsModule } from '../../platform/resource-metrics/resource-metrics.module';
import { CommonModule } from '../../platform/common/common.module';
import { StorageModule } from '../../platform/storage/storage.module';
import { FavoriteLibraryModule } from '../materials/favorite-library.module';
import { GalleryRepository } from './gallery.repository';
import { GalleryService } from './gallery.service';
import { GalleryTemplateConversionService } from './gallery-template-conversion.service';
import { GalleryController } from './gallery.controller';
import { GalleryAdminController } from './gallery-admin.controller';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ResourceMetricsModule,
    CommonModule,
    StorageModule,
    FavoriteLibraryModule,
  ],
  controllers: [GalleryController, GalleryAdminController],
  providers: [GalleryService, GalleryRepository, GalleryTemplateConversionService],
  exports: [GalleryService],
})
export class GalleryModule {}
