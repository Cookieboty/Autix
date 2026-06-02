import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PointsModule } from '../points/points.module';
import { ModelConfigModule } from '../model-config/model-config.module';
import { VideoTemplatesService } from './video-templates.service';
import {
  VideoTemplatesController,
  VideoGenerationController,
  VideoTemplatesAdminController,
} from './video-templates.controller';

@Module({
  imports: [PrismaModule, AuthModule, PointsModule, ModelConfigModule],
  controllers: [
    VideoTemplatesController,
    VideoGenerationController,
    VideoTemplatesAdminController,
  ],
  providers: [VideoTemplatesService],
  exports: [VideoTemplatesService],
})
export class VideoTemplatesModule {}
