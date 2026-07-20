import { PointsHoldReclaimCron } from './points-hold-reclaim.cron';
import type { PointsHoldService } from './points-hold.service';

/**
 * 回归：cron 内部 catch 掉异常后，必须通过 `{ failed: true }` 把失败交回
 * runInJobContext，否则 wrapper 走「返回 void 保持静默」分支，不会打
 * `job failed:`——任何按该前缀建的告警对这个 job 恒不触发。
 *
 * 这条约束覆盖全部 11 个「内部 catch」的 cron；本 spec 取积分回收作代表，
 * 因为它静默失败的后果最重（用户积分被永久冻结且无告警）。
 */
describe('PointsHoldReclaimCron 失败上报契约', () => {
  function build(reclaim: () => Promise<void>) {
    const service = { reclaimOrphanedHolds: reclaim } as unknown as PointsHoldService;
    return new PointsHoldReclaimCron(service);
  }

  it('底层抛错时返回 { failed: true } 并带上原始 error', async () => {
    const boom = new Error('db exploded');
    const result = await build(() => Promise.reject(boom)).reclaimOrphanedHolds();

    expect(result).toEqual({ failed: true, error: boom });
  });

  it('底层成功时不返回 failed（不误报）', async () => {
    const result = await build(() => Promise.resolve()).reclaimOrphanedHolds();

    expect(result).toBeUndefined();
  });

  it('不把异常向上抛：@Cron 未捕获的 rejection 会污染进程', async () => {
    await expect(
      build(() => Promise.reject(new Error('db exploded'))).reclaimOrphanedHolds(),
    ).resolves.not.toThrow();
  });
});
