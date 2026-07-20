import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { GenerationTasksAdminModule } from './generation-tasks/generation-tasks-admin.module';

@Module({
  imports: [AdminModule, GenerationTasksAdminModule],
  exports: [AdminModule, GenerationTasksAdminModule],
})
export class AdminDomainModule {}
