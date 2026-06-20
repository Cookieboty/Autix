import { Module } from '@nestjs/common';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { PointsModule } from '../../billing/points/points.module';
import { ModelConfigModule } from '../../creation/model-config/model-config.module';
import { AdminModule } from '../../admin/admin/admin.module';
import { TemplateGenerationRepository } from '../template-generation.repository';
import { VideoTemplatesService } from './video-templates.service';
import {
  VideoTemplatesController,
  VideoGenerationController,
  VideoTemplatesAdminController,
} from './video-templates.controller';

@Module({
  imports: [PrismaModule, AuthModule, PointsModule, ModelConfigModule, AdminModule],
  controllers: [
    VideoTemplatesController,
    VideoGenerationController,
    VideoTemplatesAdminController,
  ],
  providers: [TemplateGenerationRepository, VideoTemplatesService],
  exports: [VideoTemplatesService],
})
export class VideoTemplatesModule {}
