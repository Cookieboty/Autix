import { Injectable } from '@nestjs/common';
import { AppLogger } from '../common/app-logger';
import { runInJobContext } from '../common/job-context';
import { Interval } from '@nestjs/schedule';
import { BoostService } from './boost.service';

/**
 * 内容加热（Boost）聚合定时任务（gallery-design.md §十一）：
 * 每 10 分钟把当前生效加热 SUM 幂等 SET 进 resource_metrics.boostScore。
 * 与 resource-metrics 域的热度重算是两个独立的 cron（各自 10 分钟一跳），
 * boostScore 由本 cron 写入、由热度重算读取——两者之间存在最多约 10 分钟的
 * 最终一致性窗口，属可接受范围。
 */
@Injectable()
export class BoostCron {
  private readonly logger = new AppLogger(BoostCron.name);

  constructor(private readonly boostService: BoostService) {}

  @Interval(600_000)
  async aggregate() {
    return runInJobContext({ name: 'operations.boost', logger: this.logger }, async () => {
      try {
        await this.boostService.aggregateActiveBoosts();
      } catch (error) {
        this.logger.error('boost aggregation failed', error as Error);
      }
    });
  }
}
