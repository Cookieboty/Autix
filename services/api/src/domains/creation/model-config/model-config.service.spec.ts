import { NotFoundException } from '@nestjs/common';
import { ModelType, ModelVisibility } from '../../platform/prisma/generated';
import { ModelConfigRepository } from './model-config.repository';
import { ModelConfigService } from './model-config.service';

function createService(modelConfigEnabled = true) {
  const prisma = {
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
  const systemSettings = {
    getBoolean: jest.fn(async () => modelConfigEnabled),
  };

  return {
    service: new ModelConfigService(modelConfigRepository, systemSettings as never),
    prisma,
    systemSettings,
  };
}

describe('ModelConfigService private model boundaries', () => {
  it('lists only the current user private model configs', async () => {
    const { service, prisma } = createService();

    await service.findAllForUser('user-1');

    expect(prisma.model_configs.findMany).toHaveBeenCalledWith({
      where: {
        createdBy: 'user-1',
        visibility: ModelVisibility.private,
      },
      orderBy: [{ type: 'asc' }, { priority: 'desc' }],
    });
  });

  it('keeps public system models available but gates private models with the feature switch', async () => {
    const { service, prisma } = createService(false);

    await service.findAvailableModels('user-1');

    expect(prisma.model_configs.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.model_configs.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, visibility: ModelVisibility.public },
      }),
    );
  });

  it('lists system models without consulting the private model feature switch', async () => {
    const { service, prisma, systemSettings } = createService(false);

    await service.findSystemModels();

    expect(systemSettings.getBoolean).not.toHaveBeenCalled();
    expect(prisma.model_configs.findMany).toHaveBeenCalledWith({
      where: { visibility: ModelVisibility.public },
      orderBy: [{ type: 'asc' }, { priority: 'desc' }],
    });
  });

  it('always creates private model configs even if a public visibility is submitted', async () => {
    const { service, prisma } = createService();

    await service.create(
      {
        name: 'My model',
        model: 'gpt-test',
        type: ModelType.general,
        isDefault: true,
        visibility: ModelVisibility.public,
      },
      'user-1',
    );

    expect(prisma.model_configs.updateMany).toHaveBeenCalledWith({
      where: {
        type: ModelType.general,
        createdBy: 'user-1',
        visibility: ModelVisibility.private,
        isDefault: true,
      },
      data: { isDefault: false },
    });
    expect(prisma.model_configs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdBy: 'user-1',
          visibility: ModelVisibility.private,
        }),
      }),
    );
  });

  it('creates public system model configs without the private model feature switch', async () => {
    const { service, prisma, systemSettings } = createService(false);

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

    expect(systemSettings.getBoolean).not.toHaveBeenCalled();
    expect(prisma.model_configs.updateMany).toHaveBeenCalledWith({
      where: {
        type: ModelType.general,
        visibility: ModelVisibility.public,
        isDefault: true,
      },
      data: { isDefault: false },
    });
    expect(prisma.model_configs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdBy: 'admin-1',
          visibility: ModelVisibility.public,
        }),
      }),
    );
  });

  it('does not update or delete public system model configs through user endpoints', async () => {
    const { service, prisma } = createService();

    await expect(
      service.update('public-model', { name: 'Nope' }, 'admin-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.deleteForUser('public-model', 'admin-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(prisma.model_configs.update).not.toHaveBeenCalled();
    expect(prisma.model_configs.delete).not.toHaveBeenCalled();
  });

  it('updates and deletes public system models through system methods only', async () => {
    const { service, prisma, systemSettings } = createService(false);
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

    expect(systemSettings.getBoolean).not.toHaveBeenCalled();
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
});
