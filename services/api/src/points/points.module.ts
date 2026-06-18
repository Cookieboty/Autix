import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PointsService } from './points.service';
import { PointsController } from './points.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PointsController],
  providers: [PointsService],
  exports: [PointsService],
})
export class PointsModule {}
