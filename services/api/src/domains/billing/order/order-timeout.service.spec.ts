import { Logger } from '@nestjs/common';
import { OrderTimeoutService } from './order-timeout.service';

// 定时任务包装层：每分钟回收超时未支付订单。核心逻辑在 order.service 已覆盖，
// 但这个 @Cron 包装的三点契约需要在此保证：
//   1) 回收数量 > 0 时打印一条 info（包含数量与 elapsedMs）。
//   2) 回收数量 = 0 时不打印 info（避免每分钟一条空跑噪声）。
//   3) 底层抛错时不让定时器崩溃，且必须留下一条 error 日志。
// 迁移至 runInJobContext 后：wrapper 统一负责 info/error 输出，业务只负责语义。
describe('OrderTimeoutService.cancelExpiredPendingOrders (cron wrapper)', () => {
  function buildService(impl: () => Promise<number>) {
    const orderService = { cancelExpiredPendingOrders: vi.fn(impl) } as any;
    return { service: new OrderTimeoutService(orderService), orderService };
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('委托给 orderService，并在回收数量>0 时打印 info 日志', async () => {
    const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const { service, orderService } = buildService(async () => 2);

    await service.cancelExpiredPendingOrders();

    expect(orderService.cancelExpiredPendingOrders).toHaveBeenCalledTimes(1);
    // wrapper 输出格式：`[trace=job-billing.orderTimeout-<uuid>] job done: billing.orderTimeout changed=2 elapsedMs=<n>`
    const infoLine = logSpy.mock.calls
      .map((c) => String(c[0] ?? ''))
      .find((s) => s.includes('billing.orderTimeout'));
    expect(infoLine).toBeDefined();
    expect(infoLine).toContain('changed=2');
    expect(infoLine).toMatch(/\[trace=job-billing\.orderTimeout-/);
  });

  it('回收数量为 0 时不打印 info（避免噪声）', async () => {
    const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const { service } = buildService(async () => 0);

    await service.cancelExpiredPendingOrders();

    // wrapper 的 start 是 debug；空跑不返回 outcome，wrapper 不会调用 .log()。
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('底层抛错时吞掉异常并记录 error，不让定时器崩溃', async () => {
    const errorSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const { service } = buildService(async () => {
      throw new Error('db down');
    });

    // 业务把异常转换成 `{ failed: true }`；wrapper 统一打 error 并 resolve（不抛）。
    await expect(service.cancelExpiredPendingOrders()).resolves.toBeDefined();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const errLine = String(errorSpy.mock.calls[0]?.[0] ?? '');
    expect(errLine).toContain('job failed: billing.orderTimeout');
    expect(errLine).toContain('db down');
    expect(errLine).toMatch(/\[trace=job-billing\.orderTimeout-/);
  });
});
