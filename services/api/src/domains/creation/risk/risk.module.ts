import { Module } from '@nestjs/common';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { RiskService } from './risk.service';

@Module({
  imports: [PrismaModule],
  providers: [RiskService],
  exports: [RiskService],
})
export class RiskModule {}
