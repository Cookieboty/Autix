import { GenerationKind, GenerationTaskStatus } from '../prisma/generated';
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
