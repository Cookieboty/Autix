import { Module } from '@nestjs/common';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { PointsModule } from '../../billing/points/points.module';
import { MarketplaceResourceRepository } from '../marketplace-resource.repository';
import { AcquisitionsService } from './acquisitions.service';
import { AcquisitionsController } from './acquisitions.controller';

@Module({
  imports: [PrismaModule, AuthModule, PointsModule],
  controllers: [AcquisitionsController],
  providers: [AcquisitionsService, MarketplaceResourceRepository],
  exports: [AcquisitionsService],
})
export class AcquisitionsModule {}
