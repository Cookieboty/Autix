import { Module } from '@nestjs/common';
import { ImageGenController } from './image-gen.controller';

@Module({
  controllers: [ImageGenController],
})
export class ImageGenModule {}
