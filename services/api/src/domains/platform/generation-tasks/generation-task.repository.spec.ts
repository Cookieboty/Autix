import { GenerationBillingStatus, GenerationKind, GenerationTaskStatus } from '../prisma/generated';
import { AppLogger } from '../common/app-logger';
import { GenerationTaskRepository } from './generation-task.repository';

function buildTx(updateManyResult: { count: number }) {
  return {
    generation_tasks: {
      updateMany: vi.fn().mockResolvedValue(updateManyResult),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
  } as any;
}

describe('GenerationTaskRepository.claimTerminal', () => {
  it('抢到时返回 true，且 where 限定只能从 PENDING/QUEUED 迁移', async () => {
    const tx = buildTx({ count: 1 });
    const repo = new GenerationTaskRepository({} as any);

    const won = await repo.claimTerminal('t-1', { status: GenerationTaskStatus.SUCCEEDED }, tx);

    expect(won).toBe(true);
    const where = tx.generation_tasks.updateMany.mock.calls[0][0].where;
    expect(where.id).toBe('t-1');
    expect(where.status).toEqual({
      in: [GenerationTaskStatus.PENDING, GenerationTaskStatus.QUEUED],
    });
  });

  it('没抢到（已是终态或行不存在）时返回 false', async () => {
    const tx = buildTx({ count: 0 });
    const repo = new GenerationTaskRepository({} as any);

    await expect(
      repo.claimTerminal('t-1', { status: GenerationTaskStatus.FAILED }, tx),
    ).resolves.toBe(false);
  });

  it('终态→终态被拒：where 条件不含任何终态', async () => {
    const tx = buildTx({ count: 0 });
    const repo = new GenerationTaskRepository({} as any);
    await repo.claimTerminal('t-1', { status: GenerationTaskStatus.SUCCEEDED }, tx);

    const allowed = tx.generation_tasks.updateMany.mock.calls[0][0].where.status.in;
    expect(allowed).not.toContain(GenerationTaskStatus.EXPIRED);
    expect(allowed).not.toContain(GenerationTaskStatus.SUCCEEDED);
    expect(allowed).not.toContain(GenerationTaskStatus.FAILED);
  });

  it('billingStatus 传入时写进 data（收敛 cron 用于把 EXPIRED 和 hold 已退款的事实一起落库）', async () => {
    const tx = buildTx({ count: 1 });
    const repo = new GenerationTaskRepository({} as any);

    await repo.claimTerminal(
      't-1',
      { status: GenerationTaskStatus.EXPIRED, billingStatus: GenerationBillingStatus.REFUNDED },
      tx,
    );

    expect(tx.generation_tasks.updateMany.mock.calls[0][0].data.billingStatus).toBe(
      GenerationBillingStatus.REFUNDED,
    );
  });

  it('billingStatus 未传时 data 中不含该键（不得覆写 succeed/fail 场景下已有的 HELD/CONFIRMED 计费状态）', async () => {
    const tx = buildTx({ count: 1 });
    const repo = new GenerationTaskRepository({} as any);

    await repo.claimTerminal('t-1', { status: GenerationTaskStatus.SUCCEEDED }, tx);

    expect('billingStatus' in tx.generation_tasks.updateMany.mock.calls[0][0].data).toBe(false);
  });
});

describe('GenerationTaskRepository.findDanglingPending', () => {
  it('只查 PENDING 且 providerTaskId 为空的行', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repo = new GenerationTaskRepository({ generation_tasks: { findMany } } as any);

    await repo.findDanglingPending();

    const args = findMany.mock.calls[0][0];
    expect(args.where).toEqual({ status: GenerationTaskStatus.PENDING, providerTaskId: null });
    expect(args.select).toMatchObject({
      id: true,
      holdId: true,
      submittedAt: true,
      createdAt: true,
    });
  });

  /**
   * 阻塞 2：`take: 500` 没有 `orderBy` 时，Postgres 返回哪 500 条是不确定的。
   * 一旦悬挂行累积超过 500，新退款的行可能永远进不了扫描窗口——按 createdAt 升序
   * 才能保证最老的行优先收敛、窗口随收敛稳定前移。
   */
  it('按 createdAt 升序排序，保证 take 上限下的扫描窗口是确定的', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repo = new GenerationTaskRepository({ generation_tasks: { findMany } } as any);

    await repo.findDanglingPending();

    const args = findMany.mock.calls[0][0];
    expect(args.orderBy).toEqual({ createdAt: 'asc' });
    expect(args.take).toBe(500);
  });
});

describe('GenerationTaskRepository.claimTerminalStandalone', () => {
  it('自行开启事务并复用 claimTerminal 的 CAS 逻辑', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = { generation_tasks: { updateMany } };
    const $transaction = vi.fn((cb: (tx: unknown) => unknown) => cb(tx));
    const repo = new GenerationTaskRepository({ $transaction } as any);

    const won = await repo.claimTerminalStandalone('t-1', { status: GenerationTaskStatus.EXPIRED });

    expect($transaction).toHaveBeenCalledTimes(1);
    expect(won).toBe(true);
    expect(updateMany).toHaveBeenCalledTimes(1);
  });
});

describe('GenerationTaskRepository.markQueued', () => {
  it('count===0 时打 warn 日志（可能是终态已跳过，也可能是 id 不存在），且返回值/签名不变', async () => {
    const tx = buildTx({ count: 0 });
    const warnSpy = vi.spyOn(AppLogger.prototype, 'warn').mockImplementation(() => undefined);
    const repo = new GenerationTaskRepository({} as any);

    await expect(repo.markQueued('t-1', 'provider-task-1', tx)).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [message] = warnSpy.mock.calls[0];
    expect(String(message)).toContain('t-1');
    expect(String(message)).toContain('provider-task-1');

    warnSpy.mockRestore();
  });

  it('count===1 时不打 warn 日志', async () => {
    const tx = buildTx({ count: 1 });
    const warnSpy = vi.spyOn(AppLogger.prototype, 'warn').mockImplementation(() => undefined);
    const repo = new GenerationTaskRepository({} as any);

    await repo.markQueued('t-1', 'provider-task-1', tx);

    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});

describe('GenerationTaskRepository.create', () => {
  it('videoGenerationId 透传到 data（视频任务在 start 时就已知反向指针）', async () => {
    const tx = buildTx({ count: 0 });
    const repo = new GenerationTaskRepository({} as any);

    await repo.create(
      {
        id: 't-1',
        kind: GenerationKind.VIDEO,
        userId: 'u-1',
        model: 'm-1',
        promptLength: 0,
        videoGenerationId: 'vg-1',
      },
      tx,
    );

    expect(tx.generation_tasks.create.mock.calls[0][0].data.videoGenerationId).toBe('vg-1');
  });

  it('未传 videoGenerationId 时 data 中为 null', async () => {
    const tx = buildTx({ count: 0 });
    const repo = new GenerationTaskRepository({} as any);

    await repo.create(
      {
        id: 't-1',
        kind: GenerationKind.IMAGE,
        userId: 'u-1',
        model: 'm-1',
        promptLength: 0,
      },
      tx,
    );

    expect(tx.generation_tasks.create.mock.calls[0][0].data.videoGenerationId).toBeNull();
  });
});

describe('GenerationTaskRepository.deleteOlderThan', () => {
  function buildPrisma(batches: Array<{ id: string }[]>, deleteCounts: number[]) {
    const findMany = vi.fn();
    const deleteMany = vi.fn();
    batches.forEach((rows) => findMany.mockResolvedValueOnce(rows));
    findMany.mockResolvedValue([]);
    deleteCounts.forEach((count) => deleteMany.mockResolvedValueOnce({ count }));
    return { prisma: { generation_tasks: { findMany, deleteMany } } as any, findMany, deleteMany };
  }

  it('按 statuses + cutoff（days 天前）查询，一批删完即返回该批 count', async () => {
    const { prisma, findMany, deleteMany } = buildPrisma([[{ id: 'a' }, { id: 'b' }]], [2]);
    const repo = new GenerationTaskRepository(prisma);
    const before = Date.now();

    const result = await repo.deleteOlderThan({
      statuses: [GenerationTaskStatus.SUCCEEDED],
      days: 30,
    });

    expect(result).toEqual({ count: 2 });
    const findArgs = findMany.mock.calls[0][0];
    expect(findArgs.where.status).toEqual({ in: [GenerationTaskStatus.SUCCEEDED] });
    const cutoff: Date = findArgs.where.createdAt.lt;
    // cutoff 应约为 30 天前（允许测试执行耗时的毫秒级误差）。
    const expected = before - 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs(cutoff.getTime() - expected)).toBeLessThan(2000);
    expect(deleteMany.mock.calls[0][0].where.id).toEqual({ in: ['a', 'b'] });
  });

  it('多状态（FAILED + EXPIRED）一起传入 where.status.in', async () => {
    const { prisma, findMany } = buildPrisma([[{ id: 'a' }]], [1]);
    const repo = new GenerationTaskRepository(prisma);

    await repo.deleteOlderThan({
      statuses: [GenerationTaskStatus.FAILED, GenerationTaskStatus.EXPIRED],
      days: 90,
    });

    expect(findMany.mock.calls[0][0].where.status).toEqual({
      in: [GenerationTaskStatus.FAILED, GenerationTaskStatus.EXPIRED],
    });
  });

  it('单批达到 10000 条上限时继续下一批，直到不足上限为止', async () => {
    const fullBatch = Array.from({ length: 10000 }, (_, i) => ({ id: `id-${i}` }));
    const { prisma, findMany, deleteMany } = buildPrisma(
      [fullBatch, [{ id: 'last' }]],
      [10000, 1],
    );
    const repo = new GenerationTaskRepository(prisma);

    const result = await repo.deleteOlderThan({
      statuses: [GenerationTaskStatus.SUCCEEDED],
      days: 30,
    });

    expect(result).toEqual({ count: 10001 });
    expect(findMany).toHaveBeenCalledTimes(2);
    expect(deleteMany).toHaveBeenCalledTimes(2);
  });

  it('一行都没有时返回 count: 0，且不调用 deleteMany', async () => {
    const { prisma, deleteMany } = buildPrisma([[]], []);
    const repo = new GenerationTaskRepository(prisma);

    const result = await repo.deleteOlderThan({
      statuses: [GenerationTaskStatus.SUCCEEDED],
      days: 30,
    });

    expect(result).toEqual({ count: 0 });
    expect(deleteMany).not.toHaveBeenCalled();
  });
});

describe('GenerationTaskRepository.recordBilling', () => {
  function buildPrisma() {
    return { generation_tasks: { update: vi.fn().mockResolvedValue({}) } } as any;
  }

  it('传入 holdId 时写进 update 的 data（图片侧靠此回填 holdId，start 时还不知道 hold）', async () => {
    const prisma = buildPrisma();
    const repo = new GenerationTaskRepository(prisma);

    await repo.recordBilling('t-1', 'HELD' as any, undefined, 'hold-1');

    expect(prisma.generation_tasks.update.mock.calls[0][0].data.holdId).toBe('hold-1');
  });

  it('未传 holdId 时不覆写该字段（视频侧 create 时已写过 holdId，后续调用不应清空）', async () => {
    const prisma = buildPrisma();
    const repo = new GenerationTaskRepository(prisma);

    await repo.recordBilling('t-1', 'HELD' as any);

    expect(prisma.generation_tasks.update.mock.calls[0][0].data.holdId).toBeUndefined();
  });
});
