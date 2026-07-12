import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ResourceInteractionRepository } from '../../platform/common/resource-interaction.repository';
import { VideoTemplatesService } from './video-templates.service';

interface BuildOverrides {
  pointsService?: Partial<{ estimateCost: jest.Mock }>;
  templates?: Array<Record<string, unknown>>;
}

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
    video_generations: {
      create: jest.fn(async (args: any) => ({ id: args.data.id, ...args.data })),
    },
    video_templates: {
      update: jest.fn(async () => ({})),
    },
  };
  const prisma = {
    video_templates: {
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
      estimatedCost: 1600,
      taskType: 'video_generation',
      modelConfigId: 'model-1',
      breakdown: [],
      pricingSnapshot: { ruleId: 'rule-video' },
    })),
    createHold: jest.fn(async (_userId: string, _input: unknown) => ({ hold: { id: 'hold-1' }, balance: 4900 })),
    confirmHold: jest.fn(),
    refundHold: jest.fn(),
    ...overrides.pointsService,
  };
  const models = {
    getConfigForOrchestrator: jest.fn(),
  };
  const generations = {
    createVideoGeneration: jest.fn(async (args: any) => ({
      id: args.id,
      ...args,
      status: 'pending',
    })),
  };
  const membership = {
    resolveActiveMembershipLevel: jest.fn().mockResolvedValue(2),
  };
  const resources = {
    delegateFor: jest.fn(() => prisma.video_templates),
  };
  const resourceInteractions = new ResourceInteractionRepository(prisma as never);
  const service = new VideoTemplatesService(
    resourceInteractions,
    resources as never,
    points as never,
    models as never,
    generations as never,
    membership as never,
    {} as never,
  );
  return { service, tx, points, models, generations, resources, membership, resourceInteractions };
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

  it('recordView: 目标非公开可见 → NotFoundException', async () => {
    const { service } = createMocks();
    await expect(service.recordView('u1', 'tpl-pending')).rejects.toThrow(NotFoundException);
  });

  it('createGeneration: 目标非公开可见(PENDING) → NotFoundException, 不冻结积分', async () => {
    const { service, points } = createMocks();
    await expect(
      service.createGeneration('tpl-pending', 'u1', {
        modelUsed: 'seedance-pro',
        variables: { subject: 'shoe' },
      }),
    ).rejects.toThrow(NotFoundException);
    expect(points.createHold).not.toHaveBeenCalled();
  });

  it('createGeneration: 目标为 SYSTEM 来源 → NotFoundException', async () => {
    const { service } = createMocks();
    await expect(
      service.createGeneration('tpl-system', 'u1', {
        modelUsed: 'seedance-pro',
        variables: { subject: 'shoe' },
      }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('VideoTemplatesService.createGeneration billing', () => {
  it('freezes configurable template video points with duration and confirms after record creation', async () => {
    const { service, points, generations } = createMocks();

    const gen = await service.createGeneration('tpl-1', 'u1', {
      modelUsed: 'seedance-pro',
      modelConfigId: 'model-1',
      variables: { subject: 'shoe' },
      referenceImage: 'https://img.test/ref.png',
    });

    expect(points.estimateCost).toHaveBeenCalledWith({
      taskType: 'video_generation',
      modelConfigId: 'model-1',
      params: { referenceImages: 1, seconds: 5 },
      membershipLevel: 2,
    });

    const holdArgs = points.createHold.mock.calls[0][1];
    expect(holdArgs).toEqual(
      expect.objectContaining({
        taskType: 'video_generation',
        amount: 1600,
        taskId: gen.id,
        pricingSnapshot: { ruleId: 'rule-video' },
      }),
    );
    expect(holdArgs).not.toHaveProperty('refundPolicySnapshot');

    expect(generations.createVideoGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        id: gen.id,
        resolvedPrompt: 'Animate shoe',
      }),
    );
    expect(points.confirmHold).toHaveBeenCalledWith('hold-1');
  });

  it('omits modelConfigId from the estimate call when the generation has none', async () => {
    const { service, points } = createMocks();

    await service.createGeneration('tpl-1', 'u1', {
      modelUsed: 'seedance-pro',
      variables: { subject: 'shoe' },
    });

    const estimateArgs = points.estimateCost.mock.calls[0][0];
    expect(estimateArgs).not.toHaveProperty('modelConfigId');
    expect(estimateArgs).toEqual({
      taskType: 'video_generation',
      params: { referenceImages: 0, seconds: 5 },
      membershipLevel: 2,
    });
  });

  it('refunds the hold when generation record creation fails', async () => {
    const { service, generations, points } = createMocks();
    generations.createVideoGeneration.mockRejectedValue(new Error('db fail'));

    await expect(
      service.createGeneration('tpl-1', 'u1', {
        modelUsed: 'seedance-pro',
        variables: { subject: 'shoe' },
      }),
    ).rejects.toThrow('db fail');

    expect(points.refundHold).toHaveBeenCalledWith(
      'hold-1',
      'video template generation creation failed',
    );
    expect(points.confirmHold).not.toHaveBeenCalled();
  });
});

describe('VideoTemplatesService.estimateTemplateGenerationCost — new engine', () => {
  it('packs seconds/resolution/referenceImages into params', async () => {
    const estimateCost = jest.fn().mockResolvedValue({
      taskType: 'video_generation',
      estimatedCost: 320,
      pricingSnapshot: {},
    });
    const service = buildVideoTemplatesService({ pointsService: { estimateCost } });

    await (service as never as { estimateTemplateGenerationCost: Function }).estimateTemplateGenerationCost({
      taskType: 'video_generation',
      modelConfigId: 'model-1',
      seconds: 5,
      resolution: '720p',
      referenceImages: 0,
      membershipLevel: 0,
    });

    expect(estimateCost).toHaveBeenCalledWith({
      taskType: 'video_generation',
      modelConfigId: 'model-1',
      params: { seconds: 5, resolution: '720p', referenceImages: 0 },
      membershipLevel: 0,
    });
  });

  it('omits modelConfigId entirely when not provided (no bogus fallback)', async () => {
    const estimateCost = jest.fn().mockResolvedValue({
      taskType: 'video_generation',
      estimatedCost: 320,
      pricingSnapshot: {},
    });
    const service = buildVideoTemplatesService({ pointsService: { estimateCost } });

    await (service as never as { estimateTemplateGenerationCost: Function }).estimateTemplateGenerationCost({
      taskType: 'video_generation',
      seconds: 5,
      resolution: '720p',
      referenceImages: 0,
    });

    const args = estimateCost.mock.calls[0][0];
    expect(args).not.toHaveProperty('modelConfigId');
    expect(args).toEqual({
      taskType: 'video_generation',
      params: { seconds: 5, resolution: '720p', referenceImages: 0 },
    });
  });

  it('propagates the estimator rejection without a metered fallback', async () => {
    const estimateCost = jest.fn().mockRejectedValue(new BadRequestException('模型未绑定任务'));
    const service = buildVideoTemplatesService({ pointsService: { estimateCost } });

    await expect(
      (service as never as { estimateTemplateGenerationCost: Function }).estimateTemplateGenerationCost({
        taskType: 'video_generation',
        modelConfigId: 'model-1',
        seconds: 5,
        resolution: '720p',
      }),
    ).rejects.toThrow('模型未绑定任务');
  });
});
