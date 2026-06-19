import { ForbiddenException } from '@nestjs/common';
import { assertModelConfigEnabled } from './model-config-access';

function createSettings(modelConfigEnabled = true) {
  return {
    getBoolean: jest.fn(async () => modelConfigEnabled),
  };
}

describe('ModelConfigController feature switch boundaries', () => {
  it('allows admin system model listing when private model config is disabled', async () => {
    const modelConfigService = {
      findSystemModels: jest.fn(async () => []),
    };
    const systemSettingsService = createSettings(false);

    await expect(modelConfigService.findSystemModels()).resolves.toEqual([]);

    expect(modelConfigService.findSystemModels).toHaveBeenCalled();
    expect(systemSettingsService.getBoolean).not.toHaveBeenCalled();
  });

  it('blocks user private model listing when private model config is disabled', async () => {
    const modelConfigService = {
      findAllForUser: jest.fn(async () => []),
    };
    const systemSettingsService = createSettings(false);

    await expect(assertModelConfigEnabled(systemSettingsService)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(systemSettingsService.getBoolean).toHaveBeenCalledWith('features.modelConfigEnabled');
    expect(modelConfigService.findAllForUser).not.toHaveBeenCalled();
  });
});
