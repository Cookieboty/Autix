import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ModelType, ModelVisibility } from '../../platform/prisma/generated';
import { ModelConfigRepository } from './model-config.repository';
import { ModelConfigService } from './model-config.service';

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

    expect(prisma.model_configs.findMany).toHaveBeenCalledWith({
      where: { visibility: ModelVisibility.public },
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
