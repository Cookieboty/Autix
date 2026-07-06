import { Module } from '@nestjs/common';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { ResourceMetricsModule } from '../../platform/resource-metrics/resource-metrics.module';
import { GalleryRepository } from './gallery.repository';
import { GalleryService } from './gallery.service';
import { GalleryController } from './gallery.controller';
import { GalleryAdminController } from './gallery-admin.controller';

@Module({
  imports: [PrismaModule, AuthModule, ResourceMetricsModule],
  controllers: [GalleryController, GalleryAdminController],
  providers: [GalleryService, GalleryRepository],
  exports: [GalleryService],
})
export class GalleryModule {}
