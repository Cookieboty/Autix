import { GenerationTaskStatus } from '../prisma/generated';
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
