import { Module } from '@nestjs/common';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { StorageModule } from '../../platform/storage/storage.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { PointsModule } from '../../billing/points/points.module';
import { MembershipModule } from '../../billing/membership/membership.module';
import { ModelConfigModule } from '../../creation/model-config/model-config.module';
import { AdminModule } from '../../admin/admin/admin.module';
import { CommonModule } from '../../platform/common/common.module';
import { ResourceMetricsModule } from '../../platform/resource-metrics/resource-metrics.module';
import { FavoriteLibraryModule } from '../../creation/materials/favorite-library.module';
import { MarketplaceResourceCrudRepository } from '../marketplace-resource-crud.repository';
import { TemplateGenerationRepository } from '../template-generation.repository';
import { ImageTemplatesService } from './image-templates.service';
import {
  ImageTemplatesController,
  ImageGenerationController,
  ImageTemplatesAdminController,
} from './image-templates.controller';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    AuthModule,
    PointsModule,
    MembershipModule,
    ModelConfigModule,
    AdminModule,
    CommonModule,
    ResourceMetricsModule,
    FavoriteLibraryModule,
  ],
  controllers: [
    ImageTemplatesController,
    ImageGenerationController,
    ImageTemplatesAdminController,
  ],
  providers: [
    MarketplaceResourceCrudRepository,
    TemplateGenerationRepository,
    ImageTemplatesService,
  ],
  exports: [ImageTemplatesService],
})
export class ImageTemplatesModule {}
