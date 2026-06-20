import { Module } from '@nestjs/common';
import { ImageGenController } from './image-gen.controller';
import { ImageWorkbenchService } from './image-workbench.service';
import { LlmModule } from '../llm/llm.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [LlmModule, PrismaModule],
  controllers: [ImageGenController],
  providers: [ImageWorkbenchService],
})
export class ImageGenModule {}
