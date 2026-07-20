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

/**
 * 阻塞 1 回归：`generation_tasks.holdId` 为 null 时必须回退按
 * `point_holds.taskId = generation_tasks.id` 查 hold。
 *
 * 两类行会命中这条路径，且在回退存在之前都是**不朽**的（清理 cron 刻意不删
 * PENDING，收敛 cron 又只按 holdId 分派）：
 * 1. Task 2 回填脚本产出的行——回填从不写 holdId，而"没有 providerTaskId 的悬挂行"
 *    正是回填存在的意义所在；
 * 2. 图片侧 `start()` 与 `createHold()` 之间崩溃的行——holdId 只在首次
 *    `recordBilling(HELD)` 才回填，这个窗口内建的行同样 holdId 为 null。
 *
 * spec §4.2 的统一 ID 决策保证 `point_holds.taskId == generation_tasks.id` 对图片
 * （image-generation-flow.service.ts）与视频（video-generation-flow.helpers.ts）都成立。
 */
describe('悬挂收敛：holdId 为 null 时按 taskId 回退查 hold', () => {
  function taskNoHold(minutes: number, id = 't-1') {
    return {
      id,
      holdId: null,
      submittedAt: new Date(Date.now() - minutes * 60 * 1000 - 3),
      createdAt: new Date(Date.now() - minutes * 60 * 1000 - 7),
    };
  }

  it('holdId 为 null 但 point_holds.taskId 命中 REFUNDED：收敛为 EXPIRED，不再是 hold-missing 告警', async () => {
    const repo = {
      findDanglingPending: vi.fn().mockResolvedValue([taskNoHold(200)]),
      claimTerminalStandalone: vi.fn().mockResolvedValue(true),
    };
    const holds = {
      findByIds: vi.fn().mockResolvedValue([]),
      findByTaskIds: vi
        .fn()
        .mockResolvedValue([{ id: 'h-1', taskId: 't-1', status: PointHoldStatus.REFUNDED }]),
    };
    const logger = silentLogger();
    const cron = new GenerationTaskReconciliationCron(repo as any, holds as any, logger as any);

    const result = await cron.reconcile();

    expect(holds.findByTaskIds).toHaveBeenCalledWith(['t-1']);
    expect(repo.claimTerminalStandalone).toHaveBeenCalledTimes(1);
    const [, next] = repo.claimTerminalStandalone.mock.calls[0];
    expect(next.status).toBe(GenerationTaskStatus.EXPIRED);
    expect(next.billingStatus).toBe('REFUNDED');
    // 关键回归点：这一行以前会走 hold-missing 分支并每 10 分钟刷一条 error。
    expect(logger.error).not.toHaveBeenCalled();
    expect(result).toMatchObject({ changed: 1 });
  });

  it('holdId 为 null 且按 taskId 也查不到：仍然是 hold-missing 告警（真数据完整性问题）', async () => {
    const repo = {
      findDanglingPending: vi.fn().mockResolvedValue([taskNoHold(200)]),
      claimTerminalStandalone: vi.fn(),
    };
    const holds = { findByIds: vi.fn().mockResolvedValue([]), findByTaskIds: vi.fn().mockResolvedValue([]) };
    const logger = silentLogger();
    const cron = new GenerationTaskReconciliationCron(repo as any, holds as any, logger as any);

    await cron.reconcile();

    expect(repo.claimTerminalStandalone).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('hold-missing'));
  });

  it('holdId 为 null 但按 taskId 查到仍活跃的 hold：不改状态，走 hold-still-active 分支', async () => {
    const repo = {
      findDanglingPending: vi.fn().mockResolvedValue([taskNoHold(200)]),
      claimTerminalStandalone: vi.fn(),
    };
    const holds = {
      findByIds: vi.fn().mockResolvedValue([]),
      findByTaskIds: vi
        .fn()
        .mockResolvedValue([{ id: 'h-1', taskId: 't-1', status: PointHoldStatus.PENDING }]),
    };
    const logger = silentLogger();
    const cron = new GenerationTaskReconciliationCron(repo as any, holds as any, logger as any);

    await cron.reconcile();

    expect(repo.claimTerminalStandalone).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('hold-still-active'));
  });

  it('同一 taskId 存在多个 hold 时取最新的一个（repository 按 createdAt 升序返回，后者覆盖前者）', async () => {
    const repo = {
      findDanglingPending: vi.fn().mockResolvedValue([taskNoHold(200)]),
      claimTerminalStandalone: vi.fn(),
    };
    const holds = {
      findByIds: vi.fn().mockResolvedValue([]),
      // 旧 hold 已退款，但之后又建了一个仍在处理的 hold —— 最新的那个才是权威事实，
      // 据旧的 REFUNDED 收敛会把一个仍可能成功的任务错标成 EXPIRED。
      findByTaskIds: vi.fn().mockResolvedValue([
        { id: 'h-old', taskId: 't-1', status: PointHoldStatus.REFUNDED },
        { id: 'h-new', taskId: 't-1', status: PointHoldStatus.PROCESSING },
      ]),
    };
    const logger = silentLogger();
    const cron = new GenerationTaskReconciliationCron(repo as any, holds as any, logger as any);

    await cron.reconcile();

    expect(repo.claimTerminalStandalone).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('hold-still-active'));
  });

  it('全部任务都有 holdId 时不做多余的 taskId 回退查询', async () => {
    const repo = {
      findDanglingPending: vi.fn().mockResolvedValue([taskAged(200)]),
      claimTerminalStandalone: vi.fn(),
    };
    const holds = {
      findByIds: vi.fn().mockResolvedValue([{ id: 'h-1', status: PointHoldStatus.PENDING }]),
      findByTaskIds: vi.fn(),
    };
    const logger = silentLogger();
    const cron = new GenerationTaskReconciliationCron(repo as any, holds as any, logger as any);

    await cron.reconcile();

    expect(holds.findByTaskIds).not.toHaveBeenCalled();
  });
});
