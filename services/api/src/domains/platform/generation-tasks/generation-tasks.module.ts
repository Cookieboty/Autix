import { Module } from '@nestjs/common';
import { GenerationTaskRecorder } from './generation-task.recorder';
import { GenerationTaskRepository } from './generation-task.repository';

// PrismaModule 是 @Global()（见 prisma.module.ts），PrismaService 已全局可注入，
// 无需在此重复 imports。
@Module({
  providers: [GenerationTaskRepository, GenerationTaskRecorder],
  exports: [GenerationTaskRecorder],
})
export class GenerationTasksModule {}
