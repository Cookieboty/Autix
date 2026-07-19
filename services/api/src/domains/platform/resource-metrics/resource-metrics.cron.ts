import { Injectable } from '@nestjs/common';
import { AppLogger } from '../common/app-logger';
import { runInJobContext } from '../common/job-context';
import { Cron, Interval } from '@nestjs/schedule';
import { ResourceMetricsService } from './resource-metrics.service';
import { ResourceViewPipelineService } from './resource-view.pipeline';

/**
 * 指标聚合定时任务（gallery-design.md §9）：
 * - 每 10 分钟：滚动聚合当日 PV/UV（幂等）+ 重算热度，供广场排序尽快反映最新互动。
 * - 每日 3 点：对聚合结果做一次兜底 reconciliation（防止漏跑/明细表补录），再重算一次热度。
 */
@Injectable()
export class ResourceMetricsCron {
  private readonly logger = new AppLogger(ResourceMetricsCron.name);

  constructor(
    private readonly pipelineService: ResourceViewPipelineService,
    private readonly service: ResourceMetricsService,
  ) {}

  @Interval(600_000)
  async aggregateAndRecompute() {
    return runInJobContext({ name: 'platform.resourceMetricsSnapshot', logger: this.logger }, async () => {
      try {
        await this.pipelineService.aggregateDaily();
        const { updated } = await this.service.recomputeHotScores();
        this.logger.log(`hot scores recomputed: ${updated}`);
      } catch (error) {
        this.logger.error('resource metrics aggregation failed', error as Error);
      }
    });
  }

  @Cron('0 3 * * *')
  async dailyReconciliation() {
    return runInJobContext({ name: 'platform.resourceMetricsAggregate', logger: this.logger }, async () => {
      try {
        await this.pipelineService.aggregateDaily();
        const { updated } = await this.service.recomputeHotScores();
        this.logger.log(`daily reconciliation done, hot scores recomputed: ${updated}`);
      } catch (error) {
        this.logger.error('resource metrics daily reconciliation failed', error as Error);
      }
    });
  }
}
