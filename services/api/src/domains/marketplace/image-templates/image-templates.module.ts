import { Module } from '@nestjs/common';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { StorageModule } from '../../platform/storage/storage.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { PointsModule } from '../../billing/points/points.module';
import { ModelConfigModule } from '../../creation/model-config/model-config.module';
import { AdminModule } from '../../admin/admin/admin.module';
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
    ModelConfigModule,
    AdminModule,
  ],
  controllers: [
    ImageTemplatesController,
    ImageGenerationController,
    ImageTemplatesAdminController,
  ],
  providers: [TemplateGenerationRepository, ImageTemplatesService],
  exports: [ImageTemplatesService],
})
export class ImageTemplatesModule {}
