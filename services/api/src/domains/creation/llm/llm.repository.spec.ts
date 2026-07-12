import { Prisma } from '../../platform/prisma/generated';
import { LlmRepository } from './llm.repository';

type Row = Record<string, unknown> & {
  id: string;
  authorId: string;
  systemKey: string | null;
};

function project(row: Row, select?: Record<string, boolean>) {
  if (!select) return row;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(select)) out[key] = row[key];
  return out;
}

/**
 * 伪 Prisma:对 image_templates 建模并真实执行 @@unique([authorId, systemKey]);
 * 重复 create 抛真正的 P2002,验证 chat-image-tool 直通模板 find-or-create 的抢输重查。
 */
function createFakePrisma() {
  const rows: Row[] = [];
  let seq = 0;
  const image_templates = {
    findFirst: async ({ where, select }: { where: { authorId: string; systemKey: string | null }; select?: Record<string, boolean> }) => {
      const row = rows.find((r) => r.authorId === where.authorId && r.systemKey === where.systemKey);
      return row ? project(row, select) : null;
    },
    create: async ({ data, select }: { data: Row; select?: Record<string, boolean> }) => {
      const clash = rows.some((r) => r.authorId === data.authorId && r.systemKey === data.systemKey);
      if (clash) {
        throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        });
      }
      const row: Row = { ...data, id: `tpl-${++seq}` };
      rows.push(row);
      return project(row, select);
    },
  };
  return { rows, image_templates };
}

describe('LlmRepository.ensureImageToolPassthroughTemplate (find-or-create,并发安全)', () => {
  it('并发首次访问只创建一个 chat-image-tool 系统模板,双方拿到同一条', async () => {
    const prisma = createFakePrisma();
    const repo = new LlmRepository(prisma as never);

    const [a, b] = await Promise.all([
      repo.ensureImageToolPassthroughTemplate('user-1'),
      repo.ensureImageToolPassthroughTemplate('user-1'),
    ]);

    expect(prisma.rows).toHaveLength(1);
    expect(a.id).toBe(b.id);
    expect(prisma.rows[0].systemKey).toBe('chat-image-tool');
    expect(prisma.rows[0].sourceType).toBe('SYSTEM');
  });

  it('已存在时直接返回,不再创建', async () => {
    const prisma = createFakePrisma();
    const repo = new LlmRepository(prisma as never);

    const first = await repo.ensureImageToolPassthroughTemplate('user-2');
    const second = await repo.ensureImageToolPassthroughTemplate('user-2');

    expect(prisma.rows).toHaveLength(1);
    expect(second.id).toBe(first.id);
  });
});
