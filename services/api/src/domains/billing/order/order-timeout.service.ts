import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../platform/common/app-logger';
import { runInJobContext } from '../../platform/common/job-context';
import { Cron } from '@nestjs/schedule';
import { OrderService } from './order.service';

@Injectable()
export class OrderTimeoutService {
  private readonly logger = new AppLogger(OrderTimeoutService.name);

  constructor(private readonly orderService: OrderService) {}

  @Cron('* * * * *')
  async cancelExpiredPendingOrders() {
    // 通过 runInJobContext 上报结果：
    // - 有回收 → `{ changed }`，wrapper 统一打 info（保留原 "changed>0 才记" 契约）。
    // - 无回收 → 不返回值，wrapper 静默（保留原 "0 时不打日志" 契约）。
    // - 出错 → 返回 `{ failed: true, error }`，wrapper 统一打 error 并不 rethrow，
    //   避免定时器崩溃。这条通道解决评审 P1：业务 catch 吞异常后 wrapper 误报 done。
    return runInJobContext(
      { name: 'billing.orderTimeout', logger: this.logger },
      async () => {
        try {
          const cancelled = await this.orderService.cancelExpiredPendingOrders();
          if (cancelled > 0) {
            return { changed: cancelled } as const;
          }
          return undefined;
        } catch (error) {
          return { failed: true as const, error };
        }
      },
    );
  }
}
