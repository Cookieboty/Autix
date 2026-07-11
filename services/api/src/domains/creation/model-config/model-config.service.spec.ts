import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ModelType, ModelVisibility } from '../../platform/prisma/generated';
import { ModelConfigRepository } from './model-config.repository';
import { ModelConfigService } from './model-config.service';
import type { LocalizedText } from '@autix/domain/model';

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
    $transaction: jest.fn(async (callback) => callback(prisma)),
    model_config_membership_levels: {
      deleteMany: jest.fn(async () => ({ count: 0 })),
      createMany: jest.fn(async () => ({ count: 0 })),
    },
    model_configs: {
      findMany: jest.fn(async () => []),
      findFirst: jest.fn(async () => null),
      create: jest.fn(async ({ data }) => ({ id: 'model-1', ...data })),
      update: jest.fn(async ({ data }) => ({ id: 'model-1', ...data })),
      updateMany: jest.fn(async () => ({ count: 0 })),
      delete: jest.fn(async ({ where }) => ({ id: where.id })),
      findUnique: jest.fn(async () => null),
    },
  };
  const modelConfigRepository = new ModelConfigRepository(prisma as never);
  const membershipService = {
    resolveActiveMembershipLevelId: jest.fn(async (): Promise<string | null> => null),
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
    const findMany = jest.fn().mockResolvedValue([]);
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
