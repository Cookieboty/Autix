import type { Mock } from 'vitest';
import { GenerationTaskAdminRepository } from './generation-task-admin.repository';

function buildPrisma(rows: Array<{ id: string }>) {
  return {
    generation_tasks: {
      findMany: vi.fn().mockResolvedValue(rows),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    point_holds: { findFirst: vi.fn().mockResolvedValue(null) },
    points_records: { findMany: vi.fn().mockResolvedValue([]) },
  } as never;
}

describe('GenerationTaskAdminRepository.list', () => {
  it('多取一条探测下一页，返回时裁掉并给出 nextCursor', async () => {
    const rows = Array.from({ length: 21 }, (_, i) => ({ id: `t-${i}` }));
    const prisma = buildPrisma(rows);
    const repo = new GenerationTaskAdminRepository(prisma);

    const result = await repo.list({ limit: 20 } as never);

    expect((prisma as never as { generation_tasks: { findMany: Mock } }).generation_tasks.findMany.mock.calls[0][0].take).toBe(21);
    expect(result.items).toHaveLength(20);
    expect(result.nextCursor).toBe('t-19');
  });

  it('不足一页时 nextCursor 为 null', async () => {
    const repo = new GenerationTaskAdminRepository(buildPrisma([{ id: 'a' }]));
    await expect(repo.list({ limit: 20 } as never)).resolves.toMatchObject({ nextCursor: null });
  });

  it('orderBy 必须是复合的 —— 单列 createdAt 在毫秒相同时序不稳定，游标会跳行', async () => {
    const prisma = buildPrisma([]);
    await new GenerationTaskAdminRepository(prisma).list({ limit: 20 } as never);
    const orderBy = (prisma as never as { generation_tasks: { findMany: Mock } })
      .generation_tasks.findMany.mock.calls[0][0].orderBy;
    expect(orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });

  it('时间范围转成 gte/lte，q 同时匹配 id 与 providerTaskId', async () => {
    const prisma = buildPrisma([]);
    await new GenerationTaskAdminRepository(prisma).list({
      limit: 20,
      from: '2026-07-01T00:00:00.000Z',
      to: '2026-07-02T00:00:00.000Z',
      q: 'task-abc',
    } as never);
    const where = (prisma as never as { generation_tasks: { findMany: Mock } })
      .generation_tasks.findMany.mock.calls[0][0].where;
    expect(where.createdAt).toEqual({
      gte: new Date('2026-07-01T00:00:00.000Z'),
      lte: new Date('2026-07-02T00:00:00.000Z'),
    });
    expect(where.OR).toEqual([{ id: 'task-abc' }, { providerTaskId: 'task-abc' }]);
  });

  it('未提供的筛选项不得进入 where —— 否则会退化成全表扫', async () => {
    const prisma = buildPrisma([]);
    await new GenerationTaskAdminRepository(prisma).list({ limit: 20 } as never);
    const where = (prisma as never as { generation_tasks: { findMany: Mock } })
      .generation_tasks.findMany.mock.calls[0][0].where;
    expect(Object.keys(where)).toHaveLength(0);
  });
});
