import {
  ImageTemplateSource,
  Prisma,
  TemplateStatus,
} from '../../platform/prisma/generated';
import { ImageWorkbenchRepository } from './image-workbench.repository';

type Row = {
  id: string;
  authorId: string;
  systemKey: string | null;
  status: TemplateStatus;
  sourceType: ImageTemplateSource;
};

function project(row: Row, select?: Record<string, boolean>) {
  if (!select) return row;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(select)) out[key] = (row as unknown as Record<string, unknown>)[key];
  return out;
}

/**
 * 伪 Prisma:只对 image_templates 建模,并真实执行 @@unique([authorId, systemKey])——
 * 重复 create 抛真正的 Prisma.PrismaClientKnownRequestError(P2002),以便验证仓储的
 * find-or-create 抢输重查逻辑(instanceof 检查要求抛真错误类型)。
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
      const row: Row = {
        id: `tpl-${++seq}`,
        authorId: data.authorId,
        systemKey: data.systemKey,
        status: data.status,
        sourceType: data.sourceType,
      };
      rows.push(row);
      return project(row, select);
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
      const row = rows.find((r) => r.id === where.id);
      if (row) Object.assign(row, data);
      return row;
    },
  };
  return { rows, image_templates };
}

describe('ImageWorkbenchRepository.ensureWorkbenchTemplate (find-or-create,并发安全)', () => {
  it('并发首次访问只创建一个 SYSTEM 模板,抢输一方重查拿到同一条', async () => {
    const prisma = createFakePrisma();
    const repo = new ImageWorkbenchRepository(prisma as never);

    const [a, b] = await Promise.all([
      repo.ensureWorkbenchTemplate('user-1'),
      repo.ensureWorkbenchTemplate('user-1'),
    ]);

    expect(prisma.rows).toHaveLength(1);
    expect(a.id).toBe(b.id);
    expect(a.sourceType).toBe(ImageTemplateSource.SYSTEM);
    expect(a.systemKey).toBe('image-workbench');
    expect(a.status).toBe(TemplateStatus.ARCHIVED);
  });

  it('已存在时直接返回,不再创建', async () => {
    const prisma = createFakePrisma();
    const repo = new ImageWorkbenchRepository(prisma as never);

    const first = await repo.ensureWorkbenchTemplate('user-2');
    const second = await repo.ensureWorkbenchTemplate('user-2');

    expect(prisma.rows).toHaveLength(1);
    expect(second.id).toBe(first.id);
  });

  it('不同用户各自建一条', async () => {
    const prisma = createFakePrisma();
    const repo = new ImageWorkbenchRepository(prisma as never);

    const a = await repo.ensureWorkbenchTemplate('user-a');
    const b = await repo.ensureWorkbenchTemplate('user-b');

    expect(prisma.rows).toHaveLength(2);
    expect(a.id).not.toBe(b.id);
  });
});
