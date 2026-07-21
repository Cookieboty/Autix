import { Module } from '@nestjs/common';
import { ImageGenController } from './image-gen.controller';
import { ImageWorkbenchService } from './image-workbench.service';
import { ImageWorkbenchRepository } from './image-workbench.repository';
import { LlmModule } from '../llm/llm.module';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { GalleryModule } from '../gallery/gallery.module';
import { MembershipModule } from '../../billing/membership/membership.module';
import { PointsModule } from '../../billing/points/points.module';
import { GenerationTasksModule } from '../../platform/generation-tasks/generation-tasks.module';

@Module({
  imports: [
    LlmModule,
    PrismaModule,
    GalleryModule,
    MembershipModule,
    PointsModule,
    GenerationTasksModule,
  ],
  controllers: [ImageGenController],
  providers: [ImageWorkbenchService, ImageWorkbenchRepository],
  exports: [ImageWorkbenchService],
})
export class ImageGenModule {}
