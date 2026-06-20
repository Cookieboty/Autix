import { Module } from '@nestjs/common';
import { GenerationBillingService } from './generation-billing.service';

@Module({
  providers: [GenerationBillingService],
  exports: [GenerationBillingService],
})
export class GenerationBillingModule {}
