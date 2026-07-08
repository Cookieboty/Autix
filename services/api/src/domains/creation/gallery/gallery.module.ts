import { Module } from '@nestjs/common';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { ResourceMetricsModule } from '../../platform/resource-metrics/resource-metrics.module';
import { StorageModule } from '../../platform/storage/storage.module';
import { AdminModule } from '../../admin/admin/admin.module';
import { GalleryRepository } from './gallery.repository';
import { GalleryService } from './gallery.service';
import { GalleryController } from './gallery.controller';
import { GalleryAdminController } from './gallery-admin.controller';
import { GalleryMediaMigrationService } from './gallery-media-migration.service';
import { GalleryMediaMigrationCron } from './gallery-media-migration.cron';

@Module({
  // AdminModule 提供 BatchJobService（JSON 导入批任务）+ ResourceMigrationService（媒体迁移到 R2），
  // 无反向依赖 GalleryModule，直接 import 即可，无需 forwardRef。
  imports: [PrismaModule, AuthModule, ResourceMetricsModule, StorageModule, AdminModule],
  controllers: [GalleryController, GalleryAdminController],
  providers: [
    GalleryService,
    GalleryRepository,
    GalleryMediaMigrationService,
    GalleryMediaMigrationCron,
  ],
  exports: [GalleryService],
})
export class GalleryModule {}
