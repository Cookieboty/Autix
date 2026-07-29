import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { GenerationTasksAdminModule } from './generation-tasks/generation-tasks-admin.module';
import { ChatDashboardModule } from './chat-dashboard/chat-dashboard.module';

@Module({
  imports: [AdminModule, GenerationTasksAdminModule, ChatDashboardModule],
  exports: [AdminModule, GenerationTasksAdminModule, ChatDashboardModule],
})
export class AdminDomainModule {}
