import { Module } from '@nestjs/common';
import { AuthModule } from '../../identity/auth/auth.module';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import {
  PublicGrowthController,
  PublicGrowthPublishController,
} from './public-growth.controller';
import { PublicGrowthRepository } from './public-growth.repository';
import { PublicGrowthService } from './public-growth.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PublicGrowthController, PublicGrowthPublishController],
  providers: [PublicGrowthRepository, PublicGrowthService],
  exports: [PublicGrowthService],
})
export class PublicGrowthModule {}
