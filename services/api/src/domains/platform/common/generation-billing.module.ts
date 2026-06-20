import { Module } from '@nestjs/common';
import { GenerationBillingService } from './generation-billing.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [GenerationBillingService],
  exports: [GenerationBillingService],
})
export class GenerationBillingModule {}
