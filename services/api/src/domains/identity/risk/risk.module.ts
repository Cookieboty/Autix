import { Module } from '@nestjs/common';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { RiskController } from './risk.controller';
import { RiskRepository } from './risk.repository';
import { RiskService } from './risk.service';
import { RiskScoringService } from './risk-scoring.service';
import { RiskEvaluationCron } from './risk-evaluation.cron';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [RiskController],
  providers: [RiskService, RiskRepository, RiskScoringService, RiskEvaluationCron],
  exports: [RiskService, RiskScoringService],
})
export class RiskModule {}
