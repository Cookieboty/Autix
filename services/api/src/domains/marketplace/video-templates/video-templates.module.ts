import { Module } from '@nestjs/common';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { PointsModule } from '../../billing/points/points.module';
import { MembershipModule } from '../../billing/membership/membership.module';
import { ModelConfigModule } from '../../creation/model-config/model-config.module';
import { AdminModule } from '../../admin/admin/admin.module';
import { CommonModule } from '../../platform/common/common.module';
import { MarketplaceResourceCrudRepository } from '../marketplace-resource-crud.repository';
import { TemplateGenerationRepository } from '../template-generation.repository';
import { VideoTemplatesService } from './video-templates.service';
import {
  VideoTemplatesController,
  VideoGenerationController,
  VideoTemplatesAdminController,
} from './video-templates.controller';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    PointsModule,
    MembershipModule,
    ModelConfigModule,
    AdminModule,
    CommonModule,
  ],
  controllers: [
    VideoTemplatesController,
    VideoGenerationController,
    VideoTemplatesAdminController,
  ],
  providers: [
    MarketplaceResourceCrudRepository,
    TemplateGenerationRepository,
    VideoTemplatesService,
  ],
  exports: [VideoTemplatesService],
})
export class VideoTemplatesModule {}
