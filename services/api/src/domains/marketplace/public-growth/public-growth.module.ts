import { Module } from '@nestjs/common';
import { AuthModule } from '../../identity/auth/auth.module';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { PublicGrowthController } from './public-growth.controller';
import { PublicGrowthRepository } from './public-growth.repository';
import { PublicGrowthService } from './public-growth.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PublicGrowthController],
  providers: [PublicGrowthRepository, PublicGrowthService],
  exports: [PublicGrowthService],
})
export class PublicGrowthModule {}
