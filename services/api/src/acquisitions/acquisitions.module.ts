import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PointsModule } from '../points/points.module';
import { AcquisitionsService } from './acquisitions.service';
import { AcquisitionsController } from './acquisitions.controller';

@Module({
  imports: [PrismaModule, AuthModule, PointsModule],
  controllers: [AcquisitionsController],
  providers: [AcquisitionsService],
  exports: [AcquisitionsService],
})
export class AcquisitionsModule {}
