import { Injectable, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AppLogger } from '../common/app-logger';
import { runInJobContext, type JobOutcome } from '../common/job-context';
import { GenerationTaskStatus } from '../prisma/generated';
import { GenerationTaskRepository } from './generation-task.repository';

/**
 * 分级保留策略。PENDING/QUEUED **有意不在此列**：这两个状态直接按时间删除会
 * 掩盖悬挂问题——它们必须先经 `GenerationTaskReconciliationCron`（Task 10）
 * CAS 转成 EXPIRED，才能进入 90 天保留期被本 cron 清理。删掉这条等于把
 * Task 10 刚建立的悬挂告警能力抹掉，是硬要求，不是可优化项。
 */
const RETENTION: Array<{ statuses: GenerationTaskStatus[]; days: number }> = [
  { statuses: [GenerationTaskStatus.SUCCEEDED], days: 30 },
  { statuses: [GenerationTaskStatus.FAILED, GenerationTaskStatus.EXPIRED], days: 90 },
];

/**
 * `generation_tasks` 分级清理 cron：SUCCEEDED 保留 30 天（产物已落 material_assets，
 * 量大），FAILED/EXPIRED 保留 90 天（排障价值高、量小）。
 */
@Injectable()
export class GenerationTaskCleanupCron {
  constructor(
    private readonly repository: GenerationTaskRepository,
    /**
     * 构造器注入，`AppLogger` 从未注册为 Nest provider，必须 `@Optional()`，
     * 否则生产启动会抛 `UnknownDependenciesException`（Task 10 先例）。
     */
    @Optional() private readonly logger: AppLogger = new AppLogger(GenerationTaskCleanupCron.name),
  ) {}

  @Cron('0 4 * * *')
  async run(): Promise<JobOutcome> {
    return runInJobContext(
      { name: 'platform.generationTaskCleanup', logger: this.logger },
      () => this.cleanup(),
    );
  }

  async cleanup(): Promise<JobOutcome> {
    let changed = 0;
    for (const rule of RETENTION) {
      const { count } = await this.repository.deleteOlderThan(rule);
      changed += count;
    }
    return changed > 0 ? { changed } : { noop: true };
  }
}
