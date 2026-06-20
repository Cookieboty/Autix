import { Module } from '@nestjs/common';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { RiskService } from './risk.service';
import { RiskRepository } from './risk.repository';

@Module({
  imports: [PrismaModule],
  providers: [RiskService, RiskRepository],
  exports: [RiskService],
})
export class RiskModule {}
