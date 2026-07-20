import { Module } from '@nestjs/common';
import { PointsModule } from '../../billing/points/points.module';
import { GenerationTaskRecorder } from './generation-task.recorder';
import { GenerationTaskRepository } from './generation-task.repository';
import { GenerationTaskReconciliationCron } from './generation-task-reconciliation.cron';

// PrismaModule 是 @Global()（见 prisma.module.ts），PrismaService 已全局可注入，
// 无需在此重复 imports。
//
// PointsModule 是普通 import，没有用 forwardRef：PointsModule 只 import
// PrismaModule（@Global()），它自身以及它的依赖链上没有任何一环反过来 import
// GenerationTasksModule，所以这条边是单向的，不成环。（本仓已知的环出现在
// AuthModule -> CampaignModule -> PointsModule <-> MembershipModule -> OrderModule
// -> AuthModule 这一组，都在 PointsModule 内部/tasks.module.ts 里处理，与这里无关。）
@Module({
  imports: [PointsModule],
  providers: [GenerationTaskRepository, GenerationTaskRecorder, GenerationTaskReconciliationCron],
  exports: [GenerationTaskRecorder],
})
export class GenerationTasksModule {}
