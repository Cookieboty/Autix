import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ResourceInteractionRepository } from '../../platform/common/resource-interaction.repository';
import { ImageTemplatesService } from './image-templates.service';

interface BuildOverrides {
  pointsService?: Partial<{ estimateCost: jest.Mock }>;
  templates?: Array<Record<string, unknown>>;
  r2?: Partial<{ getPublicBaseUrl: jest.Mock }>;
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
  prompt: 'Make {{subject}}',
  title: 'Product',
  authorId: 'author-1',
  status: 'APPROVED',
  sourceType: 'ADMIN_CREATED',
};
const PENDING_TPL = {
  id: 'tpl-pending',
  prompt: 'Make {{subject}}',
  title: 'Draft',
  authorId: 'author-1',
  status: 'PENDING',
  sourceType: 'ADMIN_CREATED',
};
const SYSTEM_TPL = {
  id: 'tpl-system',
  prompt: 'Make {{subject}}',
  title: 'Workbench',
  authorId: 'system',
  status: 'APPROVED',
  sourceType: 'SYSTEM',
};

function createMocks(overrides: BuildOverrides = {}) {
  const templates = overrides.templates ?? [APPROVED_TPL, PENDING_TPL, SYSTEM_TPL];
  const tx = {
    image_generations: {
      create: jest.fn(async (args: any) => ({ id: args.data.id, ...args.data })),
    },
    image_templates: {
      update: jest.fn(async () => ({})),
    },
  };
  const prisma = {
    image_templates: {
      findUnique: jest.fn(async (args: any) => templates.find((t) => t.id === args.where.id) ?? null),
      findMany: jest.fn(async (args: any = {}) => templates.filter((t) => matchesWhere(t, args.where))),
      count: jest.fn(async (args: any = {}) => templates.filter((t) => matchesWhere(t, args.where)).length),
      update: jest.fn(async () => ({})),
    },
    resource_views: {
      count: jest.fn(async () => 0),
      groupBy: jest.fn(async () => []),
      create: jest.fn(async () => ({})),
    },
    resource_likes: {
      findUnique: jest.fn(async () => null),
      create: jest.fn(async (args: any) => ({ id: 'like-1', ...args.data })),
      delete: jest.fn(async () => ({})),
    },
    resource_favorites: {
      findUnique: jest.fn(async () => null),
      create: jest.fn(async (args: any) => ({ id: 'fav-1', ...args.data })),
      delete: jest.fn(async () => ({})),
    },
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(tx)),
  };
  const points = {
    estimateCost: jest.fn(async () => ({
      estimatedCost: 90,
      taskType: 'image_generation',
      modelConfigId: 'model-1',
      breakdown: [],
      pricingSnapshot: { ruleId: 'rule-image' },
    })),
    createHold: jest.fn(async (_userId: string, _input: unknown) => ({ hold: { id: 'hold-1' }, balance: 910 })),
    confirmHold: jest.fn(),
    refundHold: jest.fn(),
    ...overrides.pointsService,
  };
  const models = {
    getConfigForOrchestrator: jest.fn(),
  };
  const generations = {
    createImageGeneration: jest.fn(async (args: any) => ({
      id: args.id,
      ...args,
      status: 'pending',
    })),
  };
  const membership = {
    resolveActiveMembershipLevel: jest.fn().mockResolvedValue(2),
  };
  const resources = {
    delegateFor: jest.fn(() => prisma.image_templates),
    createImageTemplate: jest.fn(async (data: any) => ({ id: 'tpl-new', ...data })),
    updateImageTemplate: jest.fn(async (id: string, data: any) => ({ id, ...data })),
  };
  const r2 = {
    getPublicBaseUrl: jest.fn().mockResolvedValue(R2_PUBLIC_BASE),
    ...(overrides.r2 ?? {}),
  };
  const metrics = {
    getMetrics: jest.fn().mockResolvedValue({ favoriteCount: 0 }),
    getMetricsMap: jest.fn().mockResolvedValue(new Map()),
  };
  const favoriteLibrary = {
    favorite: jest.fn().mockResolvedValue({ favorited: true }),
    unfavorite: jest.fn().mockResolvedValue({ favorited: false }),
  };
  const resourceInteractions = new ResourceInteractionRepository(prisma as never);
  const service = new ImageTemplatesService(
    resourceInteractions,
    resources as never,
    r2 as never,
    points as never,
    models as never,
    generations as never,
    membership as never,
    metrics as never,
    favoriteLibrary as never,
  );
  return {
    service,
    prisma,
    tx,
    points,
    models,
    generations,
    resources,
    membership,
    resourceInteractions,
    r2,
    metrics,
    favoriteLibrary,
  };
}

function buildImageTemplatesService(overrides: BuildOverrides = {}) {
  return createMocks(overrides).service;
}

describe('ImageTemplatesService.create — admin scoped', () => {
  it('管理员创建模板: authorId=createdById=admin, sourceType=ADMIN_CREATED', async () => {
    const { service, resources } = createMocks();
    const adminId = 'admin-1';

    const tpl = await service.create(adminId, {
      title: 'Admin Template',
      category: 'portrait',
      prompt: 'Make {{subject}}',
      variables: [],
    });

    expect(tpl.authorId).toBe(adminId);
    expect(tpl.createdById).toBe(adminId);
    expect(tpl.sourceType).toBe('ADMIN_CREATED');
    expect(resources.createImageTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        authorId: adminId,
        createdById: adminId,
        sourceType: 'ADMIN_CREATED',
      }),
    );
  });
});

describe('ImageTemplatesService.create — Task 4.5：站内来源写入守卫', () => {
  it('拒绝非站内域名的 coverImage', async () => {
    const { service } = createMocks();
    await expect(
      service.create('admin-1', {
        title: 'Admin Template',
        category: 'portrait',
        prompt: 'Make {{subject}}',
        variables: [],
        coverImage: 'https://evil.com/cover.png',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('拒绝非站内域名的 exampleImages（即便 coverImage 站内）', async () => {
    const { service } = createMocks();
    await expect(
      service.create('admin-1', {
        title: 'Admin Template',
        category: 'portrait',
        prompt: 'Make {{subject}}',
        variables: [],
        coverImage: `${R2_PUBLIC_BASE}/cover.png`,
        exampleImages: [`${R2_PUBLIC_BASE}/ex-1.png`, 'https://evil.com/ex-2.png'],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('站内 coverImage/exampleImages 全部放行', async () => {
    const { service, resources } = createMocks();
    await service.create('admin-1', {
      title: 'Admin Template',
      category: 'portrait',
      prompt: 'Make {{subject}}',
      variables: [],
      coverImage: `${R2_PUBLIC_BASE}/cover.png`,
      exampleImages: [`${R2_PUBLIC_BASE}/ex-1.png`],
    });
    expect(resources.createImageTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        coverImage: `${R2_PUBLIC_BASE}/cover.png`,
        exampleImages: [`${R2_PUBLIC_BASE}/ex-1.png`],
      }),
    );
  });
});

describe('ImageTemplatesService.update — Task 4.6：站内来源守卫', () => {
  it('拒绝非站内 coverImage', async () => {
    const { service } = createMocks();
    await expect(
      service.update('tpl-1', 'author-1', { coverImage: 'https://evil.com/cover.png' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('拒绝非站内 exampleImages', async () => {
    const { service } = createMocks();
    await expect(
      service.update('tpl-1', 'author-1', {
        exampleImages: [`${R2_PUBLIC_BASE}/ex-1.png`, 'https://evil.com/ex-2.png'],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('站内 coverImage/exampleImages 放行', async () => {
    const { service, resources } = createMocks();
    await service.update('tpl-1', 'author-1', {
      coverImage: `${R2_PUBLIC_BASE}/cover.png`,
      exampleImages: [`${R2_PUBLIC_BASE}/ex-1.png`],
    });
    expect(resources.updateImageTemplate).toHaveBeenCalledWith(
      'tpl-1',
      expect.objectContaining({ coverImage: `${R2_PUBLIC_BASE}/cover.png` }),
    );
  });
});

describe('ImageTemplatesService — 公开可见守卫 (status=APPROVED && sourceType!=SYSTEM)', () => {
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
    await expect(service.like('u1', 'tpl-pending')).rejects.toThrow(NotFoundException);
  });

  it('like: 目标为 SYSTEM 来源 → NotFoundException', async () => {
    const { service } = createMocks();
    await expect(service.like('u1', 'tpl-system')).rejects.toThrow(NotFoundException);
  });

  it('favorite: 目标非公开可见 → NotFoundException', async () => {
    const { service } = createMocks();
    await expect(service.favorite('u1', 'tpl-pending')).rejects.toThrow(NotFoundException);
  });

  it('favorite: 公开可见 → 委托给 FavoriteLibraryService.favorite', async () => {
    const { service, favoriteLibrary } = createMocks();
    await service.favorite('u1', 'tpl-1');
    expect(favoriteLibrary.favorite).toHaveBeenCalledWith('u1', 'IMAGE_TEMPLATE', 'tpl-1');
  });

  it('unfavorite: 委托给 FavoriteLibraryService.unfavorite，不经公开可见守卫', async () => {
    const { service, favoriteLibrary } = createMocks();
    await service.unfavorite('u1', 'tpl-pending');
    expect(favoriteLibrary.unfavorite).toHaveBeenCalledWith('u1', 'IMAGE_TEMPLATE', 'tpl-pending');
  });

  it('findPublicVisibleById：favoriteCount 改读 resource_metrics（列已从 image_templates 删除）', async () => {
    const { service, metrics } = createMocks();
    metrics.getMetrics.mockResolvedValue({ favoriteCount: 7 });
    const row = (await service.findPublicVisibleById('tpl-1')) as { favoriteCount: number };
    expect(row.favoriteCount).toBe(7);
  });

  it('recordView: 目标非公开可见 → NotFoundException', async () => {
    const { service } = createMocks();
    await expect(service.recordView('u1', 'tpl-pending')).rejects.toThrow(NotFoundException);
  });

  it('createGeneration: 目标非公开可见(PENDING) → NotFoundException, 不冻结积分', async () => {
    const { service, points } = createMocks();
    await expect(
      service.createGeneration('tpl-pending', 'u1', {
        modelUsed: 'gpt-image-2',
        variables: { subject: 'shoe' },
      }),
    ).rejects.toThrow(NotFoundException);
    expect(points.createHold).not.toHaveBeenCalled();
  });

  it('createGeneration: 目标为 SYSTEM 来源 → NotFoundException', async () => {
    const { service } = createMocks();
    await expect(
      service.createGeneration('tpl-system', 'u1', {
        modelUsed: 'gpt-image-2',
        variables: { subject: 'shoe' },
      }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('ImageTemplatesService.createGeneration billing', () => {
  it('freezes configurable template image points and confirms after record creation', async () => {
    const { service, points, generations } = createMocks();

    const gen = await service.createGeneration('tpl-1', 'u1', {
      modelUsed: 'gpt-image-2',
      modelConfigId: 'model-1',
      variables: { subject: 'shoe' },
      referenceImage: 'https://img.test/ref.png',
    });

    expect(points.estimateCost).toHaveBeenCalledWith({
      taskType: 'image_generation',
      modelConfigId: 'model-1',
      params: { referenceImages: 1 },
      membershipLevel: 2,
    });

    const holdArgs = points.createHold.mock.calls[0][1];
    expect(holdArgs).toEqual(
      expect.objectContaining({
        taskType: 'image_generation',
        amount: 90,
        taskId: gen.id,
        pricingSnapshot: { ruleId: 'rule-image' },
      }),
    );
    expect(holdArgs).not.toHaveProperty('refundPolicySnapshot');

    expect(generations.createImageGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        id: gen.id,
        resolvedPrompt: 'Make shoe',
      }),
    );
    expect(points.confirmHold).toHaveBeenCalledWith('hold-1');
  });

  it('omits modelConfigId from the estimate call when the generation has none', async () => {
    const { service, points } = createMocks();

    await service.createGeneration('tpl-1', 'u1', {
      modelUsed: 'gpt-image-2',
      variables: { subject: 'shoe' },
    });

    const estimateArgs = points.estimateCost.mock.calls[0][0];
    expect(estimateArgs).not.toHaveProperty('modelConfigId');
    expect(estimateArgs).toEqual({
      taskType: 'image_generation',
      params: { referenceImages: 0 },
      membershipLevel: 2,
    });
  });

  it('does not create a generation when point hold fails', async () => {
    const { service, points, tx } = createMocks();
    points.createHold.mockRejectedValue(new BadRequestException('积分余额不足'));

    await expect(
      service.createGeneration('tpl-1', 'u1', {
        modelUsed: 'gpt-image-2',
        variables: { subject: 'shoe' },
      }),
    ).rejects.toThrow('积分余额不足');

    expect(tx.image_generations.create).not.toHaveBeenCalled();
    expect(points.confirmHold).not.toHaveBeenCalled();
  });

  it('rejects generation when no pricing rule exists', async () => {
    const { service, points } = createMocks();
    points.estimateCost.mockRejectedValue(new BadRequestException('未配置计费规则'));

    await expect(
      service.createGeneration('tpl-1', 'u1', {
        modelUsed: 'gpt-image-2',
        variables: { subject: 'shoe' },
      }),
    ).rejects.toThrow('未配置计费规则');

    expect(points.createHold).not.toHaveBeenCalled();
  });
});

describe('ImageTemplatesService.estimateTemplateGenerationCost — new engine', () => {
  it('passes taskType, modelConfigId and params.referenceImages', async () => {
    const estimateCost = jest.fn().mockResolvedValue({
      taskType: 'image_generation',
      estimatedCost: 45,
      pricingSnapshot: {},
    });
    const service = buildImageTemplatesService({ pointsService: { estimateCost } });

    await (service as never as { estimateTemplateGenerationCost: Function }).estimateTemplateGenerationCost({
      taskType: 'image_generation',
      modelConfigId: 'model-1',
      referenceImages: 1,
      membershipLevel: 2,
    });

    expect(estimateCost).toHaveBeenCalledWith({
      taskType: 'image_generation',
      modelConfigId: 'model-1',
      params: { referenceImages: 1 },
      membershipLevel: 2,
    });
  });

  it('omits modelConfigId entirely when not provided (no bogus fallback)', async () => {
    const estimateCost = jest.fn().mockResolvedValue({
      taskType: 'image_generation',
      estimatedCost: 45,
      pricingSnapshot: {},
    });
    const service = buildImageTemplatesService({ pointsService: { estimateCost } });

    await (service as never as { estimateTemplateGenerationCost: Function }).estimateTemplateGenerationCost({
      taskType: 'image_generation',
      referenceImages: 0,
      membershipLevel: 0,
    });

    const args = estimateCost.mock.calls[0][0];
    expect(args).not.toHaveProperty('modelConfigId');
    expect(args).toEqual({
      taskType: 'image_generation',
      params: { referenceImages: 0 },
      membershipLevel: 0,
    });
  });

  it('propagates the estimator rejection without a metered fallback', async () => {
    const estimateCost = jest.fn().mockRejectedValue(new BadRequestException('模型未绑定任务'));
    const service = buildImageTemplatesService({ pointsService: { estimateCost } });

    await expect(
      (service as never as { estimateTemplateGenerationCost: Function }).estimateTemplateGenerationCost({
        taskType: 'image_generation',
        modelConfigId: 'model-1',
        referenceImages: 0,
      }),
    ).rejects.toThrow('模型未绑定任务');
  });
});
