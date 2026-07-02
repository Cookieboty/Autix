import { Module } from '@nestjs/common';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { StorageModule } from '../../platform/storage/storage.module';
import { MembershipModule } from '../../billing/membership/membership.module';
import { PointsModule } from '../../billing/points/points.module';
import { ImageGenModule } from '../image-gen/image-gen.module';
import { LlmModule } from '../llm/llm.module';
import { CanvasBoardController } from './canvas-board.controller';
import { CanvasBoardService } from './canvas-board.service';
import { CanvasBoardRepository } from './canvas-board.repository';
import { CanvasActionService } from './canvas-action.service';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    MembershipModule,
    PointsModule,
    ImageGenModule,
    LlmModule,
  ],
  controllers: [CanvasBoardController],
  providers: [CanvasBoardService, CanvasBoardRepository, CanvasActionService],
  exports: [CanvasBoardService],
})
export class CanvasModule {}
