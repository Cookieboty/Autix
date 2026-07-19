import { runWithConcurrency } from './run-with-concurrency';

/** 每个任务开始时 +1、结束时 -1，记录整个过程中的峰值在飞数量。 */
function makeTracker() {
  let inFlight = 0;
  let peak = 0;
  const seen: number[] = [];

  const fn = async (item: number) => {
    seen.push(item);
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await new Promise<void>((resolve) => setTimeout(resolve, 1));
    inFlight -= 1;
  };

  return { fn, seen, peak: () => peak };
}

describe('runWithConcurrency', () => {
  it('每个任务恰好跑一次', async () => {
    const t = makeTracker();
    await runWithConcurrency([1, 2, 3, 4, 5], 2, t.fn);
    expect([...t.seen].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  // 退化成串行（workerCount 恒为 1）时 peak 为 1，这条会红。
  it('真正并发：峰值在飞数量达到 limit', async () => {
    const t = makeTracker();
    await runWithConcurrency([1, 2, 3, 4, 5, 6], 3, t.fn);
    expect(t.peak()).toBe(3);
  });

  // 一次性放飞全部任务时 peak 为 8，这条会红。
  it('峰值不超过 limit', async () => {
    const t = makeTracker();
    await runWithConcurrency([1, 2, 3, 4, 5, 6, 7, 8], 2, t.fn);
    expect(t.peak()).toBe(2);
  });

  it('limit 大于任务数时，并发收敛到任务数', async () => {
    const t = makeTracker();
    await runWithConcurrency([1, 2], 10, t.fn);
    expect(t.peak()).toBe(2);
  });

  it('空列表直接返回，不调用 fn', async () => {
    const fn = vi.fn(async () => {});
    await runWithConcurrency([], 4, fn);
    expect(fn).not.toHaveBeenCalled();
  });
});
