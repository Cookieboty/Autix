import { PointHoldStatus, GenerationTaskStatus } from '../prisma/generated';
import { GenerationTaskReconciliationCron } from './generation-task-reconciliation.cron';

const STALE_MS = 70 * 60 * 1000;

function taskAged(minutes: number, holdId = 'h-1', id = 't-1') {
  return {
    id,
    holdId,
    // 毫秒精度，且同批不同值（见 Global Constraints）。
    submittedAt: new Date(Date.now() - minutes * 60 * 1000 - 1),
    createdAt: new Date(Date.now() - minutes * 60 * 1000 - 2),
  };
}

function silentLogger() {
  return { error: vi.fn(), warn: vi.fn(), log: vi.fn(), debug: vi.fn() };
}

describe('悬挂收敛：只有 REFUNDED 驱动迁移', () => {
  it('hold=REFUNDED 时 CAS 标 EXPIRED，且 billingStatus 一并标 REFUNDED', async () => {
    const repo = {
      findDanglingPending: vi.fn().mockResolvedValue([taskAged(80)]),
      claimTerminalStandalone: vi.fn().mockResolvedValue(true),
    };
    const holds = { findByIds: vi.fn().mockResolvedValue([{ id: 'h-1', status: PointHoldStatus.REFUNDED }]) };
    const cron = new GenerationTaskReconciliationCron(repo as any, holds as any);

    const result = await cron.reconcile();

    expect(repo.claimTerminalStandalone).toHaveBeenCalledTimes(1);
    const [, next] = repo.claimTerminalStandalone.mock.calls[0];
    expect(next.status).toBe(GenerationTaskStatus.EXPIRED);
    expect(next.billingStatus).toBe('REFUNDED');
    expect(result).toMatchObject({ changed: 1 });
  });

  it('hold 仍活跃：即使超过 70 分钟也不改状态，只告警', async () => {
    const repo = {
      findDanglingPending: vi.fn().mockResolvedValue([taskAged(200)]),
      claimTerminalStandalone: vi.fn(),
    };
    const holds = { findByIds: vi.fn().mockResolvedValue([{ id: 'h-1', status: PointHoldStatus.PENDING }]) };
    const logger = silentLogger();
    const cron = new GenerationTaskReconciliationCron(repo as any, holds as any, logger as any);

    await cron.reconcile();

    expect(repo.claimTerminalStandalone).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('generation task reconciliation invariant violated'),
    );
  });

  it('hold 仍活跃但未超过 70 分钟：完全不告警（时间只是信号阈值，不是驱动条件）', async () => {
    const repo = {
      findDanglingPending: vi.fn().mockResolvedValue([taskAged(10)]),
      claimTerminalStandalone: vi.fn(),
    };
    const holds = { findByIds: vi.fn().mockResolvedValue([{ id: 'h-1', status: PointHoldStatus.PROCESSING }]) };
    const logger = silentLogger();
    const cron = new GenerationTaskReconciliationCron(repo as any, holds as any, logger as any);

    const result = await cron.reconcile();

    expect(repo.claimTerminalStandalone).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    expect(result).toMatchObject({ noop: true });
  });

  it('hold 缺失：不标 EXPIRED，产生数据完整性告警', async () => {
    const repo = {
      findDanglingPending: vi.fn().mockResolvedValue([taskAged(200, 'h-missing')]),
      claimTerminalStandalone: vi.fn(),
    };
    const holds = { findByIds: vi.fn().mockResolvedValue([]) };
    const logger = silentLogger();
    const cron = new GenerationTaskReconciliationCron(repo as any, holds as any, logger as any);

    await cron.reconcile();

    expect(repo.claimTerminalStandalone).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('hold=CONFIRMED：即使未超过 70 分钟也立即告警（已扣费但任务从未提交成功，最高优先级）', async () => {
    const repo = {
      findDanglingPending: vi.fn().mockResolvedValue([taskAged(1)]),
      claimTerminalStandalone: vi.fn(),
    };
    const holds = { findByIds: vi.fn().mockResolvedValue([{ id: 'h-1', status: PointHoldStatus.CONFIRMED }]) };
    const logger = silentLogger();
    const cron = new GenerationTaskReconciliationCron(repo as any, holds as any, logger as any);

    await cron.reconcile();

    expect(repo.claimTerminalStandalone).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('hold=PARTIALLY_REFUNDED：即使未超过 70 分钟也立即告警（部分退款+未完成任务=账不平）', async () => {
    const repo = {
      findDanglingPending: vi.fn().mockResolvedValue([taskAged(1)]),
      claimTerminalStandalone: vi.fn(),
    };
    const holds = {
      findByIds: vi.fn().mockResolvedValue([{ id: 'h-1', status: PointHoldStatus.PARTIALLY_REFUNDED }]),
    };
    const logger = silentLogger();
    const cron = new GenerationTaskReconciliationCron(repo as any, holds as any, logger as any);

    await cron.reconcile();

    expect(repo.claimTerminalStandalone).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it.each([PointHoldStatus.CANCELLED, PointHoldStatus.BLOCKED, PointHoldStatus.EXPIRED])(
    'hold=%s：生产代码零引用的枚举值，出现即告警不变量违反（不受年龄门槛限制）',
    async (status) => {
      const repo = {
        findDanglingPending: vi.fn().mockResolvedValue([taskAged(1)]),
        claimTerminalStandalone: vi.fn(),
      };
      const holds = { findByIds: vi.fn().mockResolvedValue([{ id: 'h-1', status }]) };
      const logger = silentLogger();
      const cron = new GenerationTaskReconciliationCron(repo as any, holds as any, logger as any);

      await cron.reconcile();

      expect(repo.claimTerminalStandalone).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledTimes(1);
    },
  );

  it('发现脏数据不返回 failed —— cron 本身执行成功了', async () => {
    const repo = {
      findDanglingPending: vi.fn().mockResolvedValue([taskAged(200)]),
      claimTerminalStandalone: vi.fn(),
    };
    const holds = { findByIds: vi.fn().mockResolvedValue([{ id: 'h-1', status: PointHoldStatus.CONFIRMED }]) };
    const cron = new GenerationTaskReconciliationCron(repo as any, holds as any);

    const result = await cron.reconcile();

    expect(result).not.toMatchObject({ failed: true });
  });

  it('一轮只打一条聚合 error，含 count 与 oldestAgeMs，并带样本 task id', async () => {
    const repo = {
      findDanglingPending: vi
        .fn()
        .mockResolvedValue([taskAged(200, 'h-1', 't-1'), taskAged(300, 'h-1', 't-2'), taskAged(400, 'h-1', 't-3')]),
      claimTerminalStandalone: vi.fn(),
    };
    const holds = { findByIds: vi.fn().mockResolvedValue([{ id: 'h-1', status: PointHoldStatus.PENDING }]) };
    const logger = silentLogger();
    const cron = new GenerationTaskReconciliationCron(repo as any, holds as any, logger as any);

    await cron.reconcile();

    expect(logger.error).toHaveBeenCalledTimes(1);
    const msg = logger.error.mock.calls[0][0] as string;
    expect(msg).toContain('count=3');
    expect(msg).toContain('oldestAgeMs=');
    expect(msg).toContain('t-3');
  });

  it('没有悬挂任务：noop，不查 hold，不告警', async () => {
    const repo = {
      findDanglingPending: vi.fn().mockResolvedValue([]),
      claimTerminalStandalone: vi.fn(),
    };
    const holds = { findByIds: vi.fn() };
    const logger = silentLogger();
    const cron = new GenerationTaskReconciliationCron(repo as any, holds as any, logger as any);

    const result = await cron.reconcile();

    expect(holds.findByIds).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    expect(result).toMatchObject({ noop: true });
  });
});
