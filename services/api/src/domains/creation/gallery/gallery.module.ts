import { Module } from '@nestjs/common';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { ResourceMetricsModule } from '../../platform/resource-metrics/resource-metrics.module';
import { CommonModule } from '../../platform/common/common.module';
import { StorageModule } from '../../platform/storage/storage.module';
import { AdminModule } from '../../admin/admin/admin.module';
import { FavoriteLibraryModule } from '../materials/favorite-library.module';
import { ResourceMigrationService } from '../../admin/admin/resource-migration.service';
import { GalleryRepository } from './gallery.repository';
import { GalleryService } from './gallery.service';
import { GalleryTemplateConversionService } from './gallery-template-conversion.service';
import { GalleryMediaMigrationService } from './gallery-media-migration.service';
import { GalleryMediaMigrationCron } from './gallery-media-migration.cron';
import { GalleryController } from './gallery.controller';
import { GalleryAdminController } from './gallery-admin.controller';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ResourceMetricsModule,
    CommonModule,
    StorageModule,
    // 取 BatchJobService（导入端点用）。AdminModule 不反向依赖 GalleryModule，无 DI 循环。
    AdminModule,
    FavoriteLibraryModule,
  ],
  controllers: [GalleryController, GalleryAdminController],
  providers: [
    GalleryService,
    GalleryRepository,
    GalleryTemplateConversionService,
    // 媒体外链 → R2 迁移 worker。ResourceMigrationService 仅依赖 CloudflareR2Service
    // （StorageModule 已引入），故就地提供，无需改动 AdminModule。
    ResourceMigrationService,
    GalleryMediaMigrationService,
    GalleryMediaMigrationCron,
  ],
  exports: [GalleryService],
})
export class GalleryModule {}
