import { ForbiddenException } from '@nestjs/common';
import { ModelConfigController } from './model-config.controller';

function createController(modelConfigEnabled = true) {
  const modelConfigService = {
    findSystemModels: jest.fn(async () => []),
    findAllForUser: jest.fn(async () => []),
  };
  const systemSettingsService = {
    getBoolean: jest.fn(async () => modelConfigEnabled),
  };

  return {
    controller: new ModelConfigController(
      modelConfigService as never,
      systemSettingsService as never,
    ),
    modelConfigService,
    systemSettingsService,
  };
}

describe('ModelConfigController feature switch boundaries', () => {
  it('allows admin system model listing when private model config is disabled', async () => {
    const { controller, modelConfigService, systemSettingsService } = createController(false);

    await expect(controller.findSystemModels()).resolves.toEqual([]);

    expect(modelConfigService.findSystemModels).toHaveBeenCalled();
    expect(systemSettingsService.getBoolean).not.toHaveBeenCalled();
  });

  it('blocks user private model listing when private model config is disabled', async () => {
    const { controller, modelConfigService, systemSettingsService } = createController(false);

    await expect(
      controller.findAll({ user: { userId: 'user-1' } } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(systemSettingsService.getBoolean).toHaveBeenCalledWith('features.modelConfigEnabled');
    expect(modelConfigService.findAllForUser).not.toHaveBeenCalled();
  });
});
