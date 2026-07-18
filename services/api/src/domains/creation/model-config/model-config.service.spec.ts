import { BadRequestException, ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { ModelType, ModelVisibility } from '../../platform/prisma/generated';
import { ModelConfigRepository } from './model-config.repository';
import { ModelConfigService, toClientModelConfig } from './model-config.service';
import type { LocalizedText } from '@autix/domain/model';
import type { PricingSchema } from '@autix/domain/pricing';

/**
 * `{ cn: '...' }` is deliberately not a valid `LocalizedText` at the type
 * level (locale keys are the closed `Locale` union, e.g. `zh-CN`) — that is
 * exactly the mistake `validateDescription` exists to catch at runtime, so
 * the malformed literal has to be forced past the compiler here.
 */
const BAD_LOCALE_DESCRIPTION = { cn: '中文' } as unknown as LocalizedText;

const VALID_PARAMS_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object' as const,
  required: ['quality'],
  properties: {
    quality: { type: 'string' as const, enum: ['low', 'high'], 'x-ui': { control: 'chips' as const } },
  },
};
const VALID_PRICING_SCHEMA = {
  terms: [{ id: 'base', op: 'add' as const, const: 10 }],
};

function createService() {
  const prisma = {
    $transaction: vi.fn(async (callback) => callback(prisma)),
    model_config_membership_levels: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
      createMany: vi.fn(async () => ({ count: 0 })),
    },
    model_configs: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }) => ({ id: 'model-1', ...data })),
      update: vi.fn(async ({ data }) => ({ id: 'model-1', ...data })),
      updateMany: vi.fn(async () => ({ count: 0 })),
      delete: vi.fn(async ({ where }) => ({ id: where.id })),
      findUnique: vi.fn(async () => null),
    },
  };
  const modelConfigRepository = new ModelConfigRepository(prisma as never);
  const membershipService = {
    resolveActiveMembershipLevelId: vi.fn(async (): Promise<string | null> => null),
  };

  return {
    service: new ModelConfigService(modelConfigRepository, membershipService as never),
    prisma,
    membershipService,
  };
}

describe('ModelConfigService public model boundaries', () => {
  it('returns only visible public models for available models', async () => {
    const { service, prisma } = createService();

    await service.findAvailableModels('user-1');

    expect(prisma.model_configs.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.model_configs.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, visibility: ModelVisibility.public },
      }),
    );
  });

  it('lists system models and strips credentials', async () => {
    const { service, prisma } = createService();
    prisma.model_configs.findMany.mockResolvedValue([
      {
        id: 'public-model',
        metadata: { baseUrl: 'https://api.example.com/v1', apiKey: 'secret' },
      },
    ] as never);

    const models = await service.findSystemModels();

    // admin 系统模型页显示全部模型（含 private），不再按 visibility 过滤
    expect(prisma.model_configs.findMany).toHaveBeenCalledWith({
      orderBy: [{ type: 'asc' }, { priority: 'desc' }],
      select: expect.objectContaining({
        allowedMembershipLevels: expect.any(Object),
      }),
    });
    expect(models[0]).toEqual(
      expect.objectContaining({
        metadata: { baseUrl: 'https://api.example.com/v1' },
      }),
    );
  });

  it('creates public system model configs', async () => {
    const { service, prisma } = createService();

    await service.createSystemModel(
      {
        name: 'System model',
        model: 'gpt-system',
        type: ModelType.general,
        isDefault: true,
        visibility: ModelVisibility.private,
        paramsSchema: VALID_PARAMS_SCHEMA,
        pricingSchema: VALID_PRICING_SCHEMA,
      },
      'admin-1',
    );

    expect(prisma.model_configs.updateMany).toHaveBeenCalledWith({
      where: {
        type: ModelType.general,
        visibility: ModelVisibility.public,
        isDefault: true,
      },
      data: { isDefault: false },
    });
    expect(prisma.model_configs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        createdBy: 'admin-1',
        visibility: ModelVisibility.public,
      }),
    });
  });

  it('updates and deletes public system models through system methods', async () => {
    const { service, prisma } = createService();
    prisma.model_configs.findFirst.mockResolvedValue({
      id: 'public-model',
      type: ModelType.general,
      visibility: ModelVisibility.public,
    } as never);

    await service.updateSystemModel('public-model', {
      name: 'Updated',
      isDefault: true,
      visibility: ModelVisibility.private,
    });
    await service.deleteSystemModel('public-model');

    expect(prisma.model_configs.updateMany).toHaveBeenCalledWith({
      where: {
        type: ModelType.general,
        visibility: ModelVisibility.public,
        isDefault: true,
        id: { not: 'public-model' },
      },
      data: { isDefault: false },
    });
    expect(prisma.model_configs.update).toHaveBeenCalledWith({
      where: { id: 'public-model' },
      data: expect.objectContaining({
        name: 'Updated',
        visibility: ModelVisibility.public,
      }),
    });
    expect(prisma.model_configs.delete).toHaveBeenCalledWith({
      where: { id: 'public-model' },
    });
  });

  it('rejects updating or deleting a non-existent system model', async () => {
    const { service, prisma } = createService();

    await expect(
      service.updateSystemModel('missing', { name: 'Nope' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.deleteSystemModel('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(prisma.model_configs.update).not.toHaveBeenCalled();
    expect(prisma.model_configs.delete).not.toHaveBeenCalled();
  });

  it('looks up by id WITHOUT a visibility filter so private models are manageable (not 404)', async () => {
    // admin 列表（findSystemModels）故意展示全部模型含 private；delete/update 必须用同样口径
    // 按 id 查，否则 private 模型「看得见却删不掉/存不了」，真实报错 404 模型配置不存在。
    const { service, prisma } = createService();
    prisma.model_configs.findFirst.mockResolvedValue({
      id: 'private-model',
      type: ModelType.general,
      visibility: ModelVisibility.private,
    } as never);

    await service.deleteSystemModel('private-model');
    await service.updateSystemModel('private-model', { name: 'Renamed' });

    const lookupCalls = prisma.model_configs.findFirst.mock.calls as unknown as Array<
      [{ where: Record<string, unknown> }]
    >;
    for (const [arg] of lookupCalls) {
      expect(arg.where).toEqual({ id: 'private-model' });
    }
    expect(prisma.model_configs.delete).toHaveBeenCalledWith({ where: { id: 'private-model' } });
    expect(prisma.model_configs.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'private-model' } }),
    );
  });

  it('ignores blank credential fields and rejects invalid base URLs on system updates', async () => {
    const { service, prisma } = createService();
    prisma.model_configs.findFirst.mockResolvedValue({
      id: 'public-model',
      type: ModelType.general,
      visibility: ModelVisibility.public,
    } as never);

    await service.updateSystemModel('public-model', {
      name: 'Updated',
      baseUrl: ' ',
      apiKey: '',
    });

    expect(prisma.model_configs.update).toHaveBeenCalledWith({
      where: { id: 'public-model' },
      data: expect.not.objectContaining({
        baseUrl: expect.anything(),
        apiKey: expect.anything(),
      }),
    });

    await expect(
      service.updateSystemModel('public-model', { baseUrl: 'cookieboty' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('filters system models by active membership level while keeping unrestricted models visible', async () => {
    const { service, prisma, membershipService } = createService();
    membershipService.resolveActiveMembershipLevelId.mockResolvedValue('level-pro');
    prisma.model_configs.findMany.mockResolvedValueOnce([
      {
        id: 'free-model',
        visibility: ModelVisibility.public,
        allowedMembershipLevels: [],
      },
      {
        id: 'pro-model',
        visibility: ModelVisibility.public,
        allowedMembershipLevels: [{ levelId: 'level-pro' }],
      },
      {
        id: 'enterprise-model',
        visibility: ModelVisibility.public,
        allowedMembershipLevels: [{ levelId: 'level-enterprise' }],
      },
    ] as never);

    const models = await service.findAvailableModels('user-1');

    expect(models.map((model) => model.id)).toEqual(['free-model', 'pro-model']);
    expect(membershipService.resolveActiveMembershipLevelId).toHaveBeenCalledWith('user-1');
  });

  it('persists system model membership whitelist when creating and updating', async () => {
    const { service, prisma } = createService();
    prisma.model_configs.findFirst.mockResolvedValue({
      id: 'public-model',
      type: ModelType.general,
      visibility: ModelVisibility.public,
    } as never);

    await service.createSystemModel(
      {
        name: 'System model',
        model: 'gpt-system',
        allowedMembershipLevelIds: ['level-pro', 'level-pro', 'level-team'],
        paramsSchema: VALID_PARAMS_SCHEMA,
        pricingSchema: VALID_PRICING_SCHEMA,
      },
      'admin-1',
    );
    await service.updateSystemModel('public-model', {
      allowedMembershipLevelIds: ['level-team'],
    });

    expect(prisma.model_config_membership_levels.createMany).toHaveBeenCalledWith({
      data: [
        { modelConfigId: 'model-1', levelId: 'level-pro' },
        { modelConfigId: 'model-1', levelId: 'level-team' },
      ],
      skipDuplicates: true,
    });
    expect(prisma.model_config_membership_levels.deleteMany).toHaveBeenCalledWith({
      where: { modelConfigId: 'public-model' },
    });
    expect(prisma.model_config_membership_levels.createMany).toHaveBeenCalledWith({
      data: [{ modelConfigId: 'public-model', levelId: 'level-team' }],
      skipDuplicates: true,
    });
  });
});

describe('ModelConfigService getConfigForOrchestrator hardening', () => {
  it('rejects a private record even when no userId is provided', async () => {
    const { service, prisma } = createService();
    prisma.model_configs.findUnique.mockResolvedValue({
      id: 'private-model',
      visibility: ModelVisibility.private,
      allowedMembershipLevels: [],
    } as never);

    await expect(service.getConfigForOrchestrator('private-model')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects a private record when a userId is provided', async () => {
    const { service, prisma } = createService();
    prisma.model_configs.findUnique.mockResolvedValue({
      id: 'private-model',
      visibility: ModelVisibility.private,
      allowedMembershipLevels: [],
    } as never);

    await expect(
      service.getConfigForOrchestrator('private-model', 'user-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns a public record', async () => {
    const { service, prisma } = createService();
    const publicRecord = {
      id: 'public-model',
      visibility: ModelVisibility.public,
      allowedMembershipLevels: [],
    };
    prisma.model_configs.findUnique.mockResolvedValue(publicRecord as never);

    await expect(service.getConfigForOrchestrator('public-model')).resolves.toEqual(
      publicRecord,
    );
  });
});

describe('ModelConfigRepository.findSystemModels select fields', () => {
  it('selects paramsSchema, pricingSchema, schemaVersion and description', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repo = new ModelConfigRepository({ model_configs: { findMany } } as never);

    await repo.findSystemModels();

    const selectArg = findMany.mock.calls[0][0].select;
    expect(selectArg.paramsSchema).toBe(true);
    expect(selectArg.pricingSchema).toBe(true);
    expect(selectArg.schemaVersion).toBe(true);
    expect(selectArg.description).toBe(true);
  });
});

describe('ModelConfigService.createSystemModel — schema requirement', () => {
  it('writes paramsSchema, pricingSchema and description through to the repository', async () => {
    const { service, prisma } = createService();

    await service.createSystemModel(
      {
        name: 'GPT Image',
        model: 'gpt-image',
        paramsSchema: VALID_PARAMS_SCHEMA,
        pricingSchema: VALID_PRICING_SCHEMA,
        description: { en: 'Fast image model' },
      },
      'admin-1',
    );

    expect(prisma.model_configs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        paramsSchema: VALID_PARAMS_SCHEMA,
        pricingSchema: VALID_PRICING_SCHEMA,
        description: { en: 'Fast image model' },
      }),
    });
  });

  it('does not write a description key when none is provided, leaving the Prisma column default', async () => {
    const { service, prisma } = createService();

    await service.createSystemModel(
      {
        name: 'GPT Image',
        model: 'gpt-image',
        paramsSchema: VALID_PARAMS_SCHEMA,
        pricingSchema: VALID_PRICING_SCHEMA,
      },
      'admin-1',
    );

    const data = prisma.model_configs.create.mock.calls[0][0].data;
    expect('description' in data).toBe(false);
  });

  it('rejects an invalid pricingSchema before writing', async () => {
    const { service, prisma } = createService();

    await expect(
      service.createSystemModel(
        {
          name: 'Bad',
          model: 'bad-model',
          paramsSchema: VALID_PARAMS_SCHEMA,
          pricingSchema: { terms: [] },
          description: {},
        },
        'admin-1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.model_configs.create).not.toHaveBeenCalled();
  });

  it('carries the violation list on the thrown error, not just a generic message', async () => {
    const { service } = createService();

    try {
      await service.createSystemModel(
        {
          name: 'Bad',
          model: 'bad-model',
          paramsSchema: VALID_PARAMS_SCHEMA,
          pricingSchema: { terms: [] },
          description: {},
        },
        'admin-1',
      );
      throw new Error('expected createSystemModel to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as {
        violations: Array<{ code: string }>;
      };
      expect(Array.isArray(response.violations)).toBe(true);
      expect(response.violations.length).toBeGreaterThan(0);
      expect(response.violations.some((v) => v.code === 'EMPTY_TERMS')).toBe(true);
    }
  });

  it('rejects a pricingSchema that references a param missing from paramsSchema', async () => {
    const { service } = createService();

    try {
      await service.createSystemModel(
        {
          name: 'Bad',
          model: 'bad-model',
          paramsSchema: { type: 'object', properties: {} },
          pricingSchema: {
            terms: [
              { id: 'base', op: 'add', const: 1 },
              { id: 'q', op: 'mul', table: { param: 'quality', values: { low: 1 } } },
            ],
          },
          description: {},
        },
        'admin-1',
      );
      throw new Error('expected createSystemModel to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as {
        violations: Array<{ code: string }>;
      };
      expect(
        response.violations.some((v) => v.code === 'PRICING_REFERENCES_UNKNOWN_PARAM'),
      ).toBe(true);
    }
  });

  it('rejects a description with an unsupported locale key', async () => {
    const { service } = createService();

    await expect(
      service.createSystemModel(
        {
          name: 'Bad',
          model: 'bad-model',
          paramsSchema: VALID_PARAMS_SCHEMA,
          pricingSchema: VALID_PRICING_SCHEMA,
          description: BAD_LOCALE_DESCRIPTION,
        },
        'admin-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts a description using the zh-CN locale key', async () => {
    const { service, prisma } = createService();

    await service.createSystemModel(
      {
        name: 'Good',
        model: 'good-model',
        paramsSchema: VALID_PARAMS_SCHEMA,
        pricingSchema: VALID_PRICING_SCHEMA,
        description: { 'zh-CN': '中文描述' },
      },
      'admin-1',
    );

    expect(prisma.model_configs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ description: { 'zh-CN': '中文描述' } }),
    });
  });
});

describe('ModelConfigService.updateSystemModel — schema validation scope', () => {
  it('updating only the description of a model with NULL schemas succeeds without touching the schemas', async () => {
    const { service, prisma } = createService();
    prisma.model_configs.findFirst.mockResolvedValue({
      id: 'model-null-schemas',
      type: ModelType.general,
      visibility: ModelVisibility.public,
      paramsSchema: null,
      pricingSchema: null,
    } as never);

    await service.updateSystemModel('model-null-schemas', { description: { en: 'Updated text' } });

    expect(prisma.model_configs.update).toHaveBeenCalledWith({
      where: { id: 'model-null-schemas' },
      data: expect.objectContaining({ description: { en: 'Updated text' } }),
    });
  });

  it('still rejects a bad locale on a description-only update, even with NULL schemas', async () => {
    const { service, prisma } = createService();
    prisma.model_configs.findFirst.mockResolvedValue({
      id: 'model-null-schemas',
      type: ModelType.general,
      visibility: ModelVisibility.public,
      paramsSchema: null,
      pricingSchema: null,
    } as never);

    await expect(
      service.updateSystemModel('model-null-schemas', { description: BAD_LOCALE_DESCRIPTION }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects updating pricingSchema alone when it references a param missing from the saved paramsSchema', async () => {
    const { service, prisma } = createService();
    prisma.model_configs.findFirst.mockResolvedValue({
      id: 'model-1',
      type: ModelType.general,
      visibility: ModelVisibility.public,
      paramsSchema: { type: 'object', properties: {} },
      pricingSchema: VALID_PRICING_SCHEMA,
    } as never);

    await expect(
      service.updateSystemModel('model-1', {
        pricingSchema: {
          terms: [
            { id: 'base', op: 'add', const: 1 },
            { id: 'q', op: 'mul', table: { param: 'quality', values: { low: 1 } } },
          ],
        },
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.model_configs.update).not.toHaveBeenCalled();
  });

  it('allows updating pricingSchema alone when the saved paramsSchema is still NULL', async () => {
    const { service, prisma } = createService();
    prisma.model_configs.findFirst.mockResolvedValue({
      id: 'model-1',
      type: ModelType.general,
      visibility: ModelVisibility.public,
      paramsSchema: null,
      pricingSchema: null,
    } as never);

    await service.updateSystemModel('model-1', { pricingSchema: VALID_PRICING_SCHEMA });

    expect(prisma.model_configs.update).toHaveBeenCalledWith({
      where: { id: 'model-1' },
      data: expect.objectContaining({ pricingSchema: VALID_PRICING_SCHEMA }),
    });
  });

  it('rejects an update with an empty-terms pricingSchema', async () => {
    const { service, prisma } = createService();
    prisma.model_configs.findFirst.mockResolvedValue({
      id: 'model-1',
      type: ModelType.general,
      visibility: ModelVisibility.public,
      paramsSchema: VALID_PARAMS_SCHEMA,
      pricingSchema: VALID_PRICING_SCHEMA,
    } as never);

    await expect(
      service.updateSystemModel('model-1', { pricingSchema: { terms: [] } }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.model_configs.update).not.toHaveBeenCalled();
  });

  it('does not validate schemas at all when neither schema field nor description is present in the update', async () => {
    const { service, prisma } = createService();
    prisma.model_configs.findFirst.mockResolvedValue({
      id: 'model-1',
      type: ModelType.general,
      visibility: ModelVisibility.public,
      paramsSchema: null,
      pricingSchema: null,
    } as never);

    await service.updateSystemModel('model-1', { priority: 5 });

    expect(prisma.model_configs.update).toHaveBeenCalledWith({
      where: { id: 'model-1' },
      data: expect.objectContaining({ priority: 5 }),
    });
  });
});

describe('toClientModelConfig', () => {
  const record = {
    id: 'm1',
    name: 'GPT Image 2',
    model: 'gpt-image-2',
    provider: 'gateway',
    type: 'general',
    capabilities: ['image'],
    isDefault: true,
    visibility: 'public',
    paramsSchema: { type: 'object', properties: {} },
    pricingSchema: { terms: [] },
    description: { en: 'x' },
    apiKey: 'sk-column-secret',
    baseUrl: 'https://internal-gateway.local',
    metadata: {
      modelFamily: 'gpt-image',
      protocolKey: 'openai-images',
      operations: ['generate', 'edit'],
      limits: { maxCount: 1 },
      apiKey: 'sk-metadata-secret',
      baseUrl: 'https://internal-gateway.local',
      someFutureInternalField: 'must-not-leak',
    },
  } as never;

  it('never returns apiKey or baseUrl, from either the column or metadata', () => {
    const dto = toClientModelConfig(record);
    const meta = dto.metadata as Record<string, unknown>;
    expect(dto.apiKey).toBeUndefined();
    expect(dto.baseUrl).toBeUndefined();
    expect(meta.apiKey).toBeUndefined();
    expect(meta.baseUrl).toBeUndefined();
  });

  it('drops unknown metadata fields by default (whitelist, not blacklist)', () => {
    // 这是白名单相对黑名单的全部意义：将来新增的内部字段默认不外泄，
    // 不需要有人记得去补一条 strip。
    const dto = toClientModelConfig(record);
    const meta = dto.metadata as Record<string, unknown>;
    expect(meta.someFutureInternalField).toBeUndefined();
  });

  it('keeps the fields the frontend actually needs', () => {
    const dto = toClientModelConfig(record);
    const meta = dto.metadata as Record<string, unknown>;
    expect(meta.modelFamily).toBe('gpt-image');
    expect(meta.protocolKey).toBe('openai-images');
    expect(meta.operations).toEqual(['generate', 'edit']);
    expect(meta.limits).toEqual({ maxCount: 1 });
    expect(dto.paramsSchema).toEqual({ type: 'object', properties: {} });
  });

  it('yields an empty metadata object when metadata is absent or not an object', () => {
    expect(toClientModelConfig({ id: 'm1' } as never).metadata).toEqual({});
    expect(toClientModelConfig({ id: 'm1', metadata: 'nope' } as never).metadata).toEqual({});
    expect(toClientModelConfig({ id: 'm1', metadata: [1, 2] } as never).metadata).toEqual({});
  });
});

describe('ModelConfigService ajv compile smoke on save', () => {
  // 这份 schema validateParamsSchema 会放行（每个 property 都有 x-ui、chips 有 enum、
  // slider 有 min/max），但 ajv strict 编译不过：allOf 的 then 分支漏写了 type。
  // 不跑编译冒烟就会存进库，直到真实下单才 500。
  const UNCOMPILABLE_PARAMS_SCHEMA = {
    type: 'object',
    properties: {
      resolution: { type: 'string', enum: ['1K', '4K'], 'x-ui': { control: 'chips' } },
      seconds: { type: 'integer', minimum: 1, maximum: 16, 'x-ui': { control: 'slider' } },
    },
    allOf: [
      {
        if: { properties: { resolution: { const: '4K' } } },
        then: { properties: { seconds: { maximum: 8 } } }, // ← 漏了 type
      },
    ],
  } as never;

  const PRICING = { terms: [{ id: 'base', op: 'add', const: 10 }] } as never;

  it('rejects a structurally-valid but uncompilable paramsSchema at create time', async () => {
    const { service } = createService();
    await expect(
      service.createSystemModel(
        {
          name: 'bad',
          model: 'bad',
          paramsSchema: UNCOMPILABLE_PARAMS_SCHEMA,
          pricingSchema: PRICING,
        } as never,
        'admin-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects it at update time too — admin 改 schema 走的恰恰是 update', async () => {
    const { service, prisma } = createService();
    // updateSystemModel → repository.findManageableSystemModel → prisma.model_configs.findFirst
    prisma.model_configs.findFirst.mockResolvedValue({
      id: 'model-1',
      visibility: 'public',
      paramsSchema: { type: 'object', properties: {} },
      pricingSchema: PRICING,
    } as never);

    await expect(
      service.updateSystemModel('model-1', {
        paramsSchema: UNCOMPILABLE_PARAMS_SCHEMA,
      } as never),
    ).rejects.toThrow(BadRequestException);
  });
});

/**
 * 墙 3（§15.2）：保存期的**跨配置**校验 —— paramsSchema ⟷ metadata.protocolKey 的 preset
 * 必须双向闭合。前两层（结构校验、ajv 编译）各自只看一份配置；一个 wire 参数在 preset 里
 * 没有绑定、或 protocolKey 指向一个不存在的 preset，两层都放行，然后在真实下单时静默丢参数
 * / 抛未捕获异常。任一层失败即拒绝保存 —— 不做「警告但允许保存」。
 */
describe('ModelConfigService — 保存期第 3 层：schema ⟷ preset 闭合校验', () => {
  const IMAGE_METADATA = {
    protocolKey: 'openai-images@v1',
    operations: ['generate', 'edit'],
    limits: { maxCount: 4 },
  };

  /** 与 gatewayOpenAIV1 双向闭合的 schema（seed-pricing.schemas.ts 的形状）。 */
  // 对 openai-images@v1 双向闭合的 schema：该 preset 的厂商字段 `size` 由统一参数
  // (aspectRatio, resolution) 拼 key 查表得到（见 presets/vendors.ts openaiImagesV1），
  // 所以 wire 侧暴露的是 aspectRatio + resolution，而不是 size 本身；quality 有直接绑定；
  // referenceImages 是 pricing 角色（不上行，无需绑定）。与 image-generation-flow 用的
  // 同口径 schema 一致。
  const CLOSED_IMAGE_PARAMS_SCHEMA = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object' as const,
    required: ['aspectRatio', 'resolution', 'quality'],
    properties: {
      aspectRatio: {
        type: 'string' as const,
        enum: ['1:1', '16:9'],
        default: '1:1',
        'x-ui': { role: 'wire' as const, control: 'select' as const },
      },
      resolution: {
        type: 'string' as const,
        enum: ['1K', '2K'],
        default: '1K',
        'x-ui': { role: 'both' as const, control: 'select' as const },
      },
      quality: {
        type: 'string' as const,
        enum: ['low', 'high'],
        default: 'low',
        'x-ui': { role: 'both' as const, control: 'chips' as const },
      },
      referenceImages: {
        type: 'integer' as const,
        minimum: 0,
        maximum: 4,
        default: 0,
        'x-ui': { role: 'pricing' as const, control: 'hidden' as const },
      },
    },
  };

  // 图片模型在 ModelType 里没有独立成员：它是 general + capabilities:['image']。
  const IMAGE_PRICING_SCHEMA: PricingSchema = {
    terms: [
      { id: 'base', op: 'add' as const, const: 1 },
      { id: 'quality', op: 'mul' as const, table: { param: 'quality', values: { low: 15, high: 350 } } },
      { id: 'resolution', op: 'mul' as const, table: { param: 'resolution', values: { '1K': 1, '2K': 2 } } },
    ],
  };

  function existingImageModel() {
    return {
      id: 'image-model-1',
      type: ModelType.general,
      visibility: ModelVisibility.public,
      metadata: IMAGE_METADATA,
      paramsSchema: CLOSED_IMAGE_PARAMS_SCHEMA,
      pricingSchema: IMAGE_PRICING_SCHEMA,
    } as never;
  }

  it('accepts a schema that is closed against the preset (create)', async () => {
    const { service, prisma } = createService();

    await expect(
      service.createSystemModel(
        {
          name: 'Image',
          model: 'gemini-3-pro-image',
          type: ModelType.general,
          capabilities: ['image'],
          metadata: IMAGE_METADATA,
          paramsSchema: CLOSED_IMAGE_PARAMS_SCHEMA,
          pricingSchema: IMAGE_PRICING_SCHEMA,
        },
        'admin-1',
      ),
    ).resolves.toBeDefined();
    expect(prisma.model_configs.create).toHaveBeenCalled();
  });

  it('rejects saving a schema whose wire param the preset cannot send (create)', async () => {
    const { service, prisma } = createService();

    // guidanceScale: role wire，但 gatewayOpenAIV1 没有它的绑定 → 上游永远收不到它，
    // 用户以为调了参数、其实被静默丢弃。前两层都放行这份 schema。
    await expect(
      service.createSystemModel(
        {
          name: 'Image',
          model: 'gemini-3-pro-image',
          type: ModelType.general,
          capabilities: ['image'],
          metadata: IMAGE_METADATA,
          paramsSchema: {
            ...CLOSED_IMAGE_PARAMS_SCHEMA,
            properties: {
              ...CLOSED_IMAGE_PARAMS_SCHEMA.properties,
              // minimum/maximum 齐全 → 第 1 层（结构校验）放行、第 2 层（ajv 编译）放行。
              // 它只可能被第 3 层拦下：preset 没有 guidanceScale 的绑定。
              guidanceScale: {
                type: 'number' as const,
                minimum: 1,
                maximum: 20,
                default: 7,
                'x-ui': { role: 'wire' as const, control: 'slider' as const },
              },
            },
          },
          pricingSchema: IMAGE_PRICING_SCHEMA,
        },
        'admin-1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.model_configs.create).not.toHaveBeenCalled();
  });

  it('rejects saving a model whose protocolKey resolves to no preset (create)', async () => {
    const { service, prisma } = createService();

    await expect(
      service.createSystemModel(
        {
          name: 'Image',
          model: 'gemini-3-pro-image',
          type: ModelType.general,
          capabilities: ['image'],
          metadata: { protocolKey: 'nope@v9', operations: ['generate'] },
          paramsSchema: CLOSED_IMAGE_PARAMS_SCHEMA,
          pricingSchema: IMAGE_PRICING_SCHEMA,
        },
        'admin-1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.model_configs.create).not.toHaveBeenCalled();
  });

  it('rejects an unclosed paramsSchema on the UPDATE path — admin edits go through update, not create', async () => {
    const { service, prisma } = createService();
    prisma.model_configs.findFirst.mockResolvedValue(existingImageModel());

    await expect(
      service.updateSystemModel('image-model-1', {
        paramsSchema: {
          ...CLOSED_IMAGE_PARAMS_SCHEMA,
          properties: {
            ...CLOSED_IMAGE_PARAMS_SCHEMA.properties,
            guidanceScale: {
              type: 'number' as const,
              minimum: 1,
              maximum: 20,
              default: 7,
              'x-ui': { role: 'wire' as const, control: 'slider' as const },
            },
          },
        },
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.model_configs.update).not.toHaveBeenCalled();
  });

  it('rejects switching metadata.protocolKey to an unregistered preset, even when paramsSchema is untouched', async () => {
    const { service, prisma } = createService();
    prisma.model_configs.findFirst.mockResolvedValue(existingImageModel());

    // metadata 单独改也必须重跑第 3 层：否则把 protocolKey 改成一个不存在的 preset，
    // 保存成功、下单时 resolveImagePreset 抛未捕获异常 → 500。
    await expect(
      service.updateSystemModel('image-model-1', {
        metadata: { ...IMAGE_METADATA, protocolKey: 'nope@v9' },
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.model_configs.update).not.toHaveBeenCalled();
  });

  it('rejects an update whose schema breaks the size composition (缺 aspectRatio)', async () => {
    const { service, prisma } = createService();
    prisma.model_configs.findFirst.mockResolvedValue(existingImageModel());

    // openai-images@v1 的 size 由 (aspectRatio, resolution) 拼成。删掉 aspectRatio 后，
    // size 绑定的一个 composeFrom 目标在 schema 里不存在 → 第 3 层判定不闭合。
    const { aspectRatio: _dropped, ...withoutAspectRatio } =
      CLOSED_IMAGE_PARAMS_SCHEMA.properties;
    await expect(
      service.updateSystemModel('image-model-1', {
        paramsSchema: {
          ...CLOSED_IMAGE_PARAMS_SCHEMA,
          required: ['resolution', 'quality'],
          properties: withoutAspectRatio,
        },
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.model_configs.update).not.toHaveBeenCalled();
  });

  it('accepts a closed update', async () => {
    const { service, prisma } = createService();
    prisma.model_configs.findFirst.mockResolvedValue(existingImageModel());

    await expect(
      service.updateSystemModel('image-model-1', {
        paramsSchema: CLOSED_IMAGE_PARAMS_SCHEMA,
      }),
    ).resolves.toBeDefined();
    expect(prisma.model_configs.update).toHaveBeenCalled();
  });

  it('does not apply the protocol check to a model that declares no protocolKey (text models)', async () => {
    const { service, prisma } = createService();
    prisma.model_configs.findFirst.mockResolvedValue({
      id: 'text-model-1',
      type: ModelType.general,
      visibility: ModelVisibility.public,
      metadata: {},
      paramsSchema: VALID_PARAMS_SCHEMA,
      pricingSchema: VALID_PRICING_SCHEMA,
    } as never);

    await expect(
      service.updateSystemModel('text-model-1', { paramsSchema: VALID_PARAMS_SCHEMA }),
    ).resolves.toBeDefined();
    expect(prisma.model_configs.update).toHaveBeenCalled();
  });
});

/**
 * 保存期第 3 层按媒体分派：protocolKey **自描述**媒体（entry.media），不再把
 * 「有 protocolKey」当成「是图片模型」的同义词去查图片 PROTOCOL_PRESETS。
 *
 * 回归守卫：改造前 assertProtocolConfigIsClosed 只认 readImageModelMetadata +
 * 图片 PROTOCOL_PRESETS。视频模型的 protocolKey（如 ark-video@v3）在图片
 * registry 里查不到 → 保存直接报「模型协议配置与参数 schema 不闭合」——视频模型
 * 从此再也配不上协议（Task 5 依赖这条路径打通）。
 */
describe('ModelConfigService — 保存期第 3 层：视频协议闭合校验（按媒体分派）', () => {
  // 线上真实形状：video_generation 的 paramsSchema 只有 ratio/duration/resolution
  // 三个属性（原生化后即火山原生名，且都在 arkVideoV3.submit.paramBindings
  // 里有绑定，闭合校验能通过）。x-ui 是本文件既有的结构校验墙
  // （validateParamsSchema 的 MISSING_X_UI）要求的字段，不是视频协议闭合校验本身
  // 要求的——没有它连第 1 层结构校验都过不了，会在到达 assertProtocolConfigIsClosed
  // 之前就被拒绝，误判成分派没生效。
  const liveVideoParamsSchema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object' as const,
    required: ['resolution', 'duration'],
    properties: {
      ratio: {
        type: 'string' as const,
        enum: ['1:1', '16:9', '9:16'],
        default: '16:9',
        'x-ui': { role: 'both' as const, control: 'chips' as const },
      },
      duration: {
        type: 'integer' as const,
        minimum: 4,
        maximum: 15,
        default: 5,
        'x-ui': { role: 'both' as const, control: 'slider' as const },
      },
      resolution: {
        type: 'string' as const,
        enum: ['480p', '720p'],
        default: '720p',
        'x-ui': { role: 'both' as const, control: 'chips' as const },
      },
    },
  };

  function existingVideoModel() {
    return {
      id: 'model-config-1',
      type: ModelType.video,
      visibility: ModelVisibility.public,
      metadata: {},
      paramsSchema: liveVideoParamsSchema,
      pricingSchema: null,
    } as never;
  }

  it('accepts a video model config whose protocolKey routes to the video registry', async () => {
    const { service, prisma } = createService();
    prisma.model_configs.findFirst.mockResolvedValue(existingVideoModel());

    await expect(
      service.updateSystemModel('model-config-1', {
        paramsSchema: liveVideoParamsSchema,
        metadata: { protocolKey: 'ark-video@v3', videoModelKind: 'seedance-2.0-fast' },
      }),
    ).resolves.toBeDefined();
    expect(prisma.model_configs.update).toHaveBeenCalled();
  });

  // 未知 protocolKey 必须是 400 violation，不能是 500。
  // 保存期用 tryResolveAnyPreset（返回 undefined）而非 resolveAnyPreset（抛普通 Error，
  // 会绕过下面的 violation 流程、把用户的配置错误变成 500）。
  it('rejects an unknown protocolKey as a 400 violation, not a 500', async () => {
    const { service, prisma } = createService();
    prisma.model_configs.findFirst.mockResolvedValue(existingVideoModel());

    await expect(
      service.updateSystemModel('model-config-1', {
        paramsSchema: liveVideoParamsSchema,
        metadata: { protocolKey: 'kling-video@v1' },
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        violations: expect.arrayContaining([expect.objectContaining({ code: 'UNKNOWN_PROTOCOL_KEY' })]),
      }),
    });
    expect(prisma.model_configs.update).not.toHaveBeenCalled();
  });

  it('still waves through a model that declares no protocolKey', async () => {
    const { service, prisma } = createService();
    prisma.model_configs.findFirst.mockResolvedValue(existingVideoModel());

    await expect(
      service.updateSystemModel('model-config-1', { paramsSchema: liveVideoParamsSchema, metadata: {} }),
    ).resolves.toBeDefined();
    expect(prisma.model_configs.update).toHaveBeenCalled();
  });

  // Task 5：capabilities.ts:196 的 detectVideoModelKind 对认不出的模型静默回退到
  // 'compatible'，而该档位驱动 buildVideoParamsSchema → 影响计价与校验。detector
  // 本身必须保持纯函数（dependency-free，shared UI 也 import 它），所以告警放在
  // 这个有 logger、且只在保存时执行一次的边界，而不是塞进 detector 里。
  describe('未显式声明 videoModelKind 时告警', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('warns when a video model does not explicitly declare videoModelKind', async () => {
      const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const { service, prisma } = createService();
      prisma.model_configs.findFirst.mockResolvedValue(existingVideoModel());

      // 静默 fallback 到 'compatible' 会让模型悄悄拿到一档错误的分辨率能力，
      // 而该档位驱动 buildVideoParamsSchema → 影响计价与校验。
      await service.updateSystemModel('model-config-1', {
        paramsSchema: liveVideoParamsSchema,
        metadata: { protocolKey: 'ark-video@v3' }, // 无 videoModelKind
      });

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('videoModelKind'));
    });

    it('does not warn when videoModelKind is explicit', async () => {
      const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const { service, prisma } = createService();
      prisma.model_configs.findFirst.mockResolvedValue(existingVideoModel());

      await service.updateSystemModel('model-config-1', {
        paramsSchema: liveVideoParamsSchema,
        metadata: { protocolKey: 'ark-video@v3', videoModelKind: 'seedance-2.0-fast' },
      });

      expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('videoModelKind'));
    });
  });
});
