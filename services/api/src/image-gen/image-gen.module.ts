import { Module } from '@nestjs/common';
import { ImageGenController } from './image-gen.controller';
import { LlmModule } from '../llm/llm.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [LlmModule, PrismaModule],
  controllers: [ImageGenController],
})
export class ImageGenModule {}
