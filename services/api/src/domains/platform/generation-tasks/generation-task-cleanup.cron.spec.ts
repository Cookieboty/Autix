import { GenerationTaskStatus } from '../prisma/generated';
import { GenerationTaskCleanupCron } from './generation-task-cleanup.cron';

describe('分级清理', () => {
  it('FAILED/EXPIRED 保留 90 天，SUCCEEDED 保留 30 天', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 3 });
    const cron = new GenerationTaskCleanupCron({ deleteOlderThan: deleteMany } as any);

    await cron.cleanup();

    const calls = deleteMany.mock.calls;
    const succeeded = calls.find((c) => c[0].statuses.includes(GenerationTaskStatus.SUCCEEDED));
    const failed = calls.find((c) => c[0].statuses.includes(GenerationTaskStatus.FAILED));
    expect(succeeded).toBeDefined();
    expect(failed).toBeDefined();
    expect(succeeded![0].days).toBe(30);
    expect(failed![0].days).toBe(90);
  });

  it('PENDING/QUEUED 永不按时间删除 —— 直接删会掩盖悬挂问题', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
    const cron = new GenerationTaskCleanupCron({ deleteOlderThan: deleteMany } as any);

    await cron.cleanup();

    for (const [arg] of deleteMany.mock.calls) {
      expect(arg.statuses).not.toContain(GenerationTaskStatus.PENDING);
      expect(arg.statuses).not.toContain(GenerationTaskStatus.QUEUED);
    }
  });

  it('返回 changed 计数供 job wrapper 打 info', async () => {
    const cron = new GenerationTaskCleanupCron({
      deleteOlderThan: vi.fn().mockResolvedValue({ count: 5 }),
    } as any);
    expect(await cron.cleanup()).toMatchObject({ changed: 10 });
  });

  it('全部批次 count=0 时返回 noop', async () => {
    const cron = new GenerationTaskCleanupCron({
      deleteOlderThan: vi.fn().mockResolvedValue({ count: 0 }),
    } as any);
    expect(await cron.cleanup()).toMatchObject({ noop: true });
  });
});
