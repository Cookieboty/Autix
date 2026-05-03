import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { AuthModule } from '../auth/auth.module';
import { PointsModule } from '../points/points.module';
import { ImageTemplatesService } from './image-templates.service';
import {
  ImageTemplatesController,
  ImageGenerationController,
  ImageTemplatesAdminController,
} from './image-templates.controller';

@Module({
  imports: [PrismaModule, StorageModule, AuthModule, PointsModule],
  controllers: [
    ImageTemplatesController,
    ImageGenerationController,
    ImageTemplatesAdminController,
  ],
  providers: [ImageTemplatesService],
  exports: [ImageTemplatesService],
})
export class ImageTemplatesModule {}
