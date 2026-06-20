import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [AdminModule],
  exports: [AdminModule],
})
export class AdminDomainModule {}
