import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PointsHoldService } from './points-hold.service';

/**
 * FIX-10: 定时回收孤儿 hold（每 10 分钟）。
 * 长期 PENDING/PROCESSING 的 hold 会永久冻结用户积分（任务崩溃/未落库等），此处定期释放。
 */
@Injectable()
export class PointsHoldReclaimCron {
  private readonly logger = new Logger(PointsHoldReclaimCron.name);

  constructor(private readonly pointsHoldService: PointsHoldService) {}

  @Cron('*/10 * * * *')
  async reclaimOrphanedHolds() {
    try {
      await this.pointsHoldService.reclaimOrphanedHolds();
    } catch (error) {
      this.logger.error('reclaim orphaned holds failed', error as Error);
    }
  }
}
