import { MarketplaceActivityRepository, type HistoryCursor } from './marketplace-activity.repository';

interface ViewRow {
  id: string;
  userId: string;
  resourceType: string;
  resourceId: string;
  viewedAt: Date;
}

/**
 * Plan C Task 11：历史列表去重 + 游标翻页。
 *
 * 本仓库没有跑真实 Postgres 的集成测试基建（docker-compose 的 postgres 服务只挂给部署容器，
 * CI 也不跑 `pnpm test`；见 favorite-library.service.spec.ts / system-settings.service.spec.ts
 * 等既有 `$queryRaw` spec 的一致惯例：全部是内存 fake，不连真实 DB）。
 *
 * 这里的 fake `$queryRaw` 保留真正的 tagged-template 调用形态（`(strings, ...values)`），
 * 用来断言 listHistory 确实是参数化标签模板调用、不是字符串拼接（见下方注入回归测试）；
 * 具体返回值则在 JS 侧对内存 store 重新实现与生产 SQL 完全一致的语义——按
 * (resourceType, resourceId) 去重取 viewedAt 最新一条，再按
 * (viewedAt desc, resourceId desc, resourceType desc) 做 keyset 游标翻页——作为该 SQL 契约的
 * 可执行规格，不是对生产 SQL 字符串本身在真实 Postgres 里的执行验证。
 */
function makeFakePrisma(seedRows: ViewRow[] = []) {
  const store: ViewRow[] = [...seedRows];
  let counter = seedRows.length;
  const queryRawCalls: Array<{ strings: TemplateStringsArray; values: unknown[] }> = [];

  function dedupeLatestPerResource(userId: string): ViewRow[] {
    const latest = new Map<string, ViewRow>();
    for (const row of store) {
      if (row.userId !== userId) continue;
      const key = `${row.resourceType}:${row.resourceId}`;
      const existing = latest.get(key);
      if (
        !existing ||
        row.viewedAt.getTime() > existing.viewedAt.getTime() ||
        (row.viewedAt.getTime() === existing.viewedAt.getTime() && row.id > existing.id)
      ) {
        latest.set(key, row);
      }
    }
    return Array.from(latest.values());
  }

  // 对应生产 SQL 外层 `ORDER BY "viewedAt" DESC, "resourceId" DESC, "resourceType" DESC`。
  function sortDesc(rows: ViewRow[]): ViewRow[] {
    return [...rows].sort((a, b) => {
      if (a.viewedAt.getTime() !== b.viewedAt.getTime()) {
        return b.viewedAt.getTime() - a.viewedAt.getTime();
      }
      if (a.resourceId !== b.resourceId) return a.resourceId < b.resourceId ? 1 : -1;
      return a.resourceType < b.resourceType ? 1 : -1;
    });
  }

  // 与生产 listHistory 完全对齐的三元 keyset 比较：全部字段同向 DESC，等价于行构造器 `<`。
  function beforeCursor(row: ViewRow, cursor: HistoryCursor): boolean {
    if (row.viewedAt.getTime() !== cursor.viewedAt.getTime()) {
      return row.viewedAt.getTime() < cursor.viewedAt.getTime();
    }
    if (row.resourceId !== cursor.resourceId) return row.resourceId < cursor.resourceId;
    return row.resourceType < cursor.resourceType;
  }

  const prisma = {
    resource_views: {
      create: async ({ data }: any) => {
        counter += 1;
        const row: ViewRow = {
          id: `view-${counter}`,
          userId: data.userId,
          resourceType: data.resourceType,
          resourceId: data.resourceId,
          // 每次 create 严格递增，保证同一批 seed 内 viewedAt 全序，贴近真实浏览时间线。
          viewedAt: data.viewedAt ?? new Date(1_700_000_000_000 + counter * 1000),
        };
        store.push(row);
        return row;
      },
      findFirst: async ({ where }: any) => {
        const row = store.find(
          (r) =>
            (where.userId === undefined || r.userId === where.userId) &&
            (where.resourceType === undefined || r.resourceType === where.resourceType) &&
            (where.resourceId === undefined || r.resourceId === where.resourceId),
        );
        return row ? { id: row.id } : null;
      },
    },
    // 生产代码固定两条分支各调用一次 tagged template：无游标时 values=[userId, limit+1]
    // （长度 2），有游标时 values=[userId, viewedAt, resourceId, resourceType, limit+1]
    // （长度 5）——两条分支参数位置都是硬编码、显式的，fake 按长度识别后走同一份去重实现。
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]): Promise<ViewRow[]> => {
      queryRawCalls.push({ strings, values });
      const userId = values[0] as string;
      const hasCursor = values.length === 5;
      const cursor: HistoryCursor | undefined = hasCursor
        ? {
            viewedAt: values[1] as Date,
            resourceId: values[2] as string,
            resourceType: values[3] as string as never,
          }
        : undefined;
      const limitPlusOne = (hasCursor ? values[4] : values[1]) as number;

      let rows = sortDesc(dedupeLatestPerResource(userId));
      if (cursor) rows = rows.filter((row) => beforeCursor(row, cursor));
      return rows.slice(0, limitPlusOne);
    },
    __queryRawCalls: queryRawCalls,
  };

  return prisma;
}

const userId = 'user-1';
const g1 = 'gallery-1';
const g2 = 'gallery-2';
const g3 = 'gallery-3';

async function view(prisma: ReturnType<typeof makeFakePrisma>, uid: string, resourceType: string, resourceId: string) {
  return prisma.resource_views.create({ data: { userId: uid, resourceType, resourceId } });
}

describe('MarketplaceActivityRepository.listHistory — Plan C Task 11：按资源去重取最近 + 游标翻页', () => {
  it('历史列表按 (resourceType, resourceId) 去重，只保留最近一条', async () => {
    const prisma = makeFakePrisma();
    await view(prisma, userId, 'GALLERY_POST', g1);
    await view(prisma, userId, 'GALLERY_POST', g1);
    await view(prisma, userId, 'GALLERY_POST', g2);
    const repo = new MarketplaceActivityRepository(prisma as never);

    const list = await repo.listHistory(userId, undefined, 10);

    expect(list.items.filter((i) => i.resourceId === g1)).toHaveLength(1);
    expect(list.items).toHaveLength(2);
  });

  it('去重后保留的是 viewedAt 最新那条（不是第一条/任意一条）', async () => {
    const prisma = makeFakePrisma();
    const first = await view(prisma, userId, 'GALLERY_POST', g1);
    const second = await view(prisma, userId, 'GALLERY_POST', g1);
    const repo = new MarketplaceActivityRepository(prisma as never);

    const list = await repo.listHistory(userId, undefined, 10);
    const kept = list.items.find((i) => i.resourceId === g1)!;

    expect(second.viewedAt.getTime()).toBeGreaterThan(first.viewedAt.getTime());
    expect(kept.id).toBe(second.id);
    expect(kept.viewedAt.getTime()).toBe(second.viewedAt.getTime());
  });

  it('列表按 viewedAt DESC 排序（最近浏览排最前）', async () => {
    const prisma = makeFakePrisma();
    await view(prisma, userId, 'GALLERY_POST', g1);
    await view(prisma, userId, 'IMAGE_TEMPLATE', g2);
    await view(prisma, userId, 'VIDEO_TEMPLATE', g3);
    const repo = new MarketplaceActivityRepository(prisma as never);

    const list = await repo.listHistory(userId, undefined, 10);

    expect(list.items.map((i) => i.resourceId)).toEqual([g3, g2, g1]);
  });

  it('不同用户的浏览记录互不干扰', async () => {
    const prisma = makeFakePrisma();
    await view(prisma, userId, 'GALLERY_POST', g1);
    await view(prisma, 'other-user', 'GALLERY_POST', g2);
    const repo = new MarketplaceActivityRepository(prisma as never);

    const list = await repo.listHistory(userId, undefined, 10);

    expect(list.items).toHaveLength(1);
    expect(list.items[0].resourceId).toBe(g1);
  });

  it('cursor 分页：take 恰好等于剩余条数时 nextCursor 为 null（无下一页）', async () => {
    const prisma = makeFakePrisma();
    await view(prisma, userId, 'GALLERY_POST', g1);
    await view(prisma, userId, 'GALLERY_POST', g2);
    const repo = new MarketplaceActivityRepository(prisma as never);

    const list = await repo.listHistory(userId, undefined, 2);

    expect(list.items).toHaveLength(2);
    expect(list.nextCursor).toBeNull();
  });

  it('cursor 分页：take 小于总数时返回 nextCursor，用它翻页能拿到剩余且不重复/不遗漏', async () => {
    const prisma = makeFakePrisma();
    await view(prisma, userId, 'GALLERY_POST', g1);
    await view(prisma, userId, 'GALLERY_POST', g2);
    await view(prisma, userId, 'GALLERY_POST', g3);
    const repo = new MarketplaceActivityRepository(prisma as never);

    const page1 = await repo.listHistory(userId, undefined, 2);
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await repo.listHistory(userId, page1.nextCursor!, 2);
    expect(page2.items).toHaveLength(1);
    expect(page2.nextCursor).toBeNull();

    const allIds = [...page1.items, ...page2.items].map((i) => i.resourceId).sort();
    expect(allIds).toEqual([g1, g2, g3].sort());
    // 翻页拿到的和第一页不重复
    const page1Ids = new Set(page1.items.map((i) => i.resourceId));
    expect(page2.items.some((i) => page1Ids.has(i.resourceId))).toBe(false);
  });

  it('userId 参数化传参：$queryRaw 以 tagged template 调用，SQL 文本里不含用户输入字面量（防注入回归）', async () => {
    const prisma = makeFakePrisma();
    const maliciousUserId = `u1'; DROP TABLE "resource_views"; --`;
    const repo = new MarketplaceActivityRepository(prisma as never);

    await repo.listHistory(maliciousUserId, undefined, 10);

    expect(prisma.__queryRawCalls).toHaveLength(1);
    const call = prisma.__queryRawCalls[0];
    // 真正的 tagged-template 调用才会有 `.raw`（TemplateStringsArray 特有属性）；
    // 若生产代码退化成字符串拼接传给 $queryRaw，这里第一个参数就不再是 TemplateStringsArray。
    expect(Array.isArray(call.strings)).toBe(true);
    expect('raw' in call.strings).toBe(true);
    // 恶意 userId 只出现在参数数组里，SQL 文本片段（strings）里完全不含它。
    expect(call.strings.join('')).not.toContain(maliciousUserId);
    expect(call.values).toContain(maliciousUserId);
  });

  it('cursor 参数同样走参数化占位符，不拼接进 SQL 文本', async () => {
    const prisma = makeFakePrisma();
    const repo = new MarketplaceActivityRepository(prisma as never);
    const maliciousResourceId = `g1'; DROP TABLE "resource_views"; --`;
    const cursor: HistoryCursor = {
      viewedAt: new Date(),
      resourceType: 'GALLERY_POST' as never,
      resourceId: maliciousResourceId,
    };

    await repo.listHistory(userId, cursor, 10);

    const call = prisma.__queryRawCalls[0];
    expect(call.strings.join('')).not.toContain(maliciousResourceId);
    expect(call.values).toContain(maliciousResourceId);
  });
});

describe('MarketplaceActivityRepository.hasViewed — Plan C Task 11：saveFromHistory 反伪造前置校验', () => {
  it('用户确有对应 resource_views 记录 → true', async () => {
    const prisma = makeFakePrisma();
    await view(prisma, userId, 'GALLERY_POST', g1);
    const repo = new MarketplaceActivityRepository(prisma as never);

    await expect(repo.hasViewed(userId, 'GALLERY_POST' as never, g1)).resolves.toBe(true);
  });

  it('用户从未浏览过该资源 → false（阻断伪造历史保存）', async () => {
    const prisma = makeFakePrisma();
    const repo = new MarketplaceActivityRepository(prisma as never);

    await expect(repo.hasViewed(userId, 'GALLERY_POST' as never, g1)).resolves.toBe(false);
  });

  it('该资源被别人浏览过，但不是当前用户 → false', async () => {
    const prisma = makeFakePrisma();
    await view(prisma, 'other-user', 'GALLERY_POST', g1);
    const repo = new MarketplaceActivityRepository(prisma as never);

    await expect(repo.hasViewed(userId, 'GALLERY_POST' as never, g1)).resolves.toBe(false);
  });
});
