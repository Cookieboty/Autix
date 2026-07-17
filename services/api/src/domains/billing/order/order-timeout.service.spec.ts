import { Logger } from '@nestjs/common';
import { OrderTimeoutService } from './order-timeout.service';

// 定时任务包装层：每分钟回收超时未支付订单。核心逻辑在 order.service 已覆盖，
// 但这个 @Cron 包装的两点契约（>0 才记日志、失败必须吞掉不让定时器崩）无测试。
describe('OrderTimeoutService.cancelExpiredPendingOrders (cron wrapper)', () => {
  function buildService(impl: () => Promise<number>) {
    const orderService = { cancelExpiredPendingOrders: vi.fn(impl) } as any;
    return { service: new OrderTimeoutService(orderService), orderService };
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('委托给 orderService，并在回收数量>0 时打印日志', async () => {
    const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const { service, orderService } = buildService(async () => 2);

    await service.cancelExpiredPendingOrders();

    expect(orderService.cancelExpiredPendingOrders).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith('cancelled expired pending orders: 2');
  });

  it('回收数量为 0 时不打印日志（避免噪声）', async () => {
    const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const { service } = buildService(async () => 0);

    await service.cancelExpiredPendingOrders();

    expect(logSpy).not.toHaveBeenCalled();
  });

  it('底层抛错时吞掉异常并记录 error，不让定时器崩溃', async () => {
    const errorSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const { service } = buildService(async () => {
      throw new Error('db down');
    });

    // 不抛出即为通过
    await expect(service.cancelExpiredPendingOrders()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
