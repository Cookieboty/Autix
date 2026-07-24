import type { Mock } from 'vitest';
import { ResourceInteractionRepository } from '../../platform/common/resource-interaction.repository';
import { VideoTemplatesService } from './video-templates.service';

interface BuildOverrides {
  pointsService?: Partial<{ estimateCost: Mock }>;
  templates?: Array<Record<string, unknown>>;
  r2?: Partial<{ getPublicBaseUrl: Mock }>;
}

/** 测试用站内存储域名基准，与 r2 mock 的 getPublicBaseUrl 返回值保持一致（Task 4.5）。 */
const R2_PUBLIC_BASE = 'https://cdn.autix.test';

// 极简 Prisma where 匹配器：支持 flat 字段相等、AND 数组、{not: x}
function matchesWhere(row: Record<string, unknown>, where?: Record<string, unknown>): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, cond]) => {
    if (key === 'AND') {
      return (cond as Array<Record<string, unknown>>).every((sub) => matchesWhere(row, sub));
    }
    if (key === 'OR') {
      return (cond as Array<Record<string, unknown>>).some((sub) => matchesWhere(row, sub));
    }
    const val = row[key];
    if (cond && typeof cond === 'object' && 'not' in (cond as Record<string, unknown>)) {
      return val !== (cond as Record<string, unknown>).not;
    }
    return val === cond;
  });
}

const APPROVED_TPL = {
  id: 'tpl-1',
  prompt: 'Animate {{subject}}',
  title: 'Clip',
  authorId: 'author-1',
  durationSec: 5,
  status: 'APPROVED',
  sourceType: 'ADMIN_CREATED',
};
const PENDING_TPL = {
  id: 'tpl-pending',
  prompt: 'Animate {{subject}}',
  title: 'Draft Clip',
  authorId: 'author-1',
  durationSec: 5,
  status: 'PENDING',
  sourceType: 'ADMIN_CREATED',
};
const SYSTEM_TPL = {
  id: 'tpl-system',
  prompt: 'Animate {{subject}}',
  title: 'Workbench Clip',
  authorId: 'system',
  durationSec: 5,
  status: 'APPROVED',
  sourceType: 'SYSTEM',
};

function createMocks(overrides: BuildOverrides = {}) {
  const templates = overrides.templates ?? [APPROVED_TPL, PENDING_TPL, SYSTEM_TPL];
  const tx = {
    video_templates: {
      update: vi.fn(async () => ({})),
    },
  };
  const prisma = {
    video_templates: {
      findUnique: vi.fn(async (args: any) => templates.find((t) => t.id === args.where.id) ?? null),
      findMany: vi.fn(async (args: any = {}) => templates.filter((t) => matchesWhere(t, args.where))),
      count: vi.fn(async (args: any = {}) => templates.filter((t) => matchesWhere(t, args.where)).length),
      update: vi.fn(async () => ({})),
    },
    resource_views: {
      count: vi.fn(async () => 0),
      groupBy: vi.fn(async () => []),
      create: vi.fn(async () => ({})),
    },
    resource_likes: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async (args: any) => ({ id: 'like-1', ...args.data })),
      delete: vi.fn(async () => ({})),
    },
    resource_favorites: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async (args: any) => ({ id: 'fav-1', ...args.data })),
      delete: vi.fn(async () => ({})),
    },
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(tx)),
  };
  const points = {
    estimateCost: vi.fn(async () => ({
      estimatedCost: 1600,
      taskType: 'video_generation',
      modelConfigId: 'model-1',
      breakdown: [],
      pricingSnapshot: { ruleId: 'rule-video' },
    })),
    createHold: vi.fn(async (_userId: string, _input: unknown) => ({ hold: { id: 'hold-1' }, balance: 4900 })),
    confirmHold: vi.fn(),
    refundHold: vi.fn(),
    ...overrides.pointsService,
  };
  const models = {
    getConfigForOrchestrator: vi.fn(),
  };
  const membership = {
    resolveActiveMembershipLevel: vi.fn().mockResolvedValue(2),
  };
  const resources = {
    delegateFor: vi.fn(() => prisma.video_templates),
    createVideoTemplate: vi.fn(async (data: any) => ({ id: 'tpl-new', ...data })),
    updateVideoTemplate: vi.fn(async (id: string, data: any) => ({ id, ...data })),
  };
  const r2 = {
    getPublicBaseUrl: vi.fn().mockResolvedValue(R2_PUBLIC_BASE),
    ...(overrides.r2 ?? {}),
  };
  const metrics = {
    getMetrics: vi.fn().mockResolvedValue({ favoriteCount: 0 }),
    getMetricsMap: vi.fn().mockResolvedValue(new Map()),
  };
  const favoriteLibrary = {
    favorite: vi.fn().mockResolvedValue({ favorited: true }),
    unfavorite: vi.fn().mockResolvedValue({ favorited: false }),
  };
  const resourceInteractions = new ResourceInteractionRepository(prisma as never);
  const service = new VideoTemplatesService(
    resourceInteractions,
    resources as never,
    r2 as never,
    metrics as never,
    favoriteLibrary as never,
  );
  return {
    service,
    tx,
    points,
    models,
    resources,
    resourceInteractions,
    r2,
    metrics,
    favoriteLibrary,
  };
}

function buildVideoTemplatesService(overrides: BuildOverrides = {}) {
  return createMocks(overrides).service;
}

describe('VideoTemplatesService — 公开可见守卫 (status=APPROVED && sourceType!=SYSTEM)', () => {
  it('findPublicVisibleById: 非 APPROVED 模板 → null', async () => {
    const { service } = createMocks();
    const row = await service.findPublicVisibleById('tpl-pending');
    expect(row).toBeNull();
  });

  it('findPublicVisibleById: SYSTEM 来源模板(即使 APPROVED) → null', async () => {
    const { service } = createMocks();
    const row = await service.findPublicVisibleById('tpl-system');
    expect(row).toBeNull();
  });

  it('findPublicVisibleById: 不存在的 id → null', async () => {
    const { service } = createMocks();
    const row = await service.findPublicVisibleById('tpl-missing');
    expect(row).toBeNull();
  });

  it('findPublicVisibleById: APPROVED 且非 SYSTEM → 返回该模板', async () => {
    const { service } = createMocks();
    const row = (await service.findPublicVisibleById('tpl-1')) as { id: string } | null;
    expect(row?.id).toBe('tpl-1');
  });

  it('公开列表 findAll: 只返回 APPROVED && sourceType!=SYSTEM', async () => {
    const { service } = createMocks();
    const res = await service.findAll({});
    const items = res.items as Array<{ id: string; status: string; sourceType: string }>;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((t) => t.status === 'APPROVED' && t.sourceType !== 'SYSTEM')).toBe(true);
    expect(items.some((t) => t.id === 'tpl-pending')).toBe(false);
    expect(items.some((t) => t.id === 'tpl-system')).toBe(false);
  });

  it('like: 目标非公开可见(PENDING) → NotFoundException', async () => {
    const { service } = createMocks();
    await expect(service.like('u1', 'tpl-pending')).rejects.toMatchObject({ status: 404 });
  });

  it('like: 目标为 SYSTEM 来源 → NotFoundException', async () => {
    const { service } = createMocks();
    await expect(service.like('u1', 'tpl-system')).rejects.toMatchObject({ status: 404 });
  });

  it('favorite: 目标非公开可见 → NotFoundException', async () => {
    const { service } = createMocks();
    await expect(service.favorite('u1', 'tpl-pending')).rejects.toMatchObject({ status: 404 });
  });

  it('favorite: 公开可见 → 委托给 FavoriteLibraryService.favorite', async () => {
    const { service, favoriteLibrary } = createMocks();
    await service.favorite('u1', 'tpl-1');
    expect(favoriteLibrary.favorite).toHaveBeenCalledWith('u1', 'VIDEO_TEMPLATE', 'tpl-1');
  });

  it('unfavorite: 委托给 FavoriteLibraryService.unfavorite，不经公开可见守卫', async () => {
    const { service, favoriteLibrary } = createMocks();
    await service.unfavorite('u1', 'tpl-pending');
    expect(favoriteLibrary.unfavorite).toHaveBeenCalledWith('u1', 'VIDEO_TEMPLATE', 'tpl-pending');
  });

  it('findPublicVisibleById：favoriteCount 改读 resource_metrics（列已从 video_templates 删除）', async () => {
    const { service, metrics } = createMocks();
    metrics.getMetrics.mockResolvedValue({ favoriteCount: 9 });
    const row = (await service.findPublicVisibleById('tpl-1')) as { favoriteCount: number };
    expect(row.favoriteCount).toBe(9);
  });

  it('recordView: 目标非公开可见 → NotFoundException', async () => {
    const { service } = createMocks();
    await expect(service.recordView('u1', 'tpl-pending')).rejects.toMatchObject({ status: 404 });
  });

});
