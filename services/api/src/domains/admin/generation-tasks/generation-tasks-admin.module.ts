import { Module } from '@nestjs/common';
import { GenerationTaskAdminController } from './generation-task-admin.controller';
import { GenerationTaskAdminRepository } from './generation-task-admin.repository';
import { GenerationTaskAdminService } from './generation-task-admin.service';

// PrismaModule 是 @Global()，无需在此 imports。
@Module({
  controllers: [GenerationTaskAdminController],
  providers: [GenerationTaskAdminRepository, GenerationTaskAdminService],
})
export class GenerationTasksAdminModule {}
