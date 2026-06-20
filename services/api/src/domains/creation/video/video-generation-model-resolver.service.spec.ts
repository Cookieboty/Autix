import { BadRequestException } from '@nestjs/common';
import { ModelType } from '../../platform/prisma/generated';
import { VideoGenerationModelResolverService } from './video-generation-model-resolver.service';

function makeResolver(options: {
  params?: Record<string, unknown> | null;
  defaultModel?: { id: string; name: string; model: string } | null;
  apiKey?: string | null;
} = {}) {
  const repository = {
    updateClipParams: jest.fn(),
  };
  const modelConfigService = {
    findDefaultByType: jest.fn(async () =>
      options.defaultModel === undefined
        ? { id: 'model-default', name: 'Seedance', model: 'seedance-pro' }
        : options.defaultModel,
    ),
    getConfigForOrchestrator: jest.fn(async (id: string) => ({
      id,
      model: 'seedance-pro',
      apiKey: options.apiKey === undefined ? 'video-key' : options.apiKey,
    })),
  };

  const resolver = new VideoGenerationModelResolverService(
    repository as never,
    modelConfigService as never,
  );

  return { resolver, repository, modelConfigService };
}

describe('VideoGenerationModelResolverService', () => {
  it('uses the clip model config without querying the default video model', async () => {
    const { resolver, repository, modelConfigService } = makeResolver();

    const result = await resolver.resolveForGeneration({
      id: 'clip-1',
      params: { modelConfigId: 'model-explicit' },
    });

    expect(result.modelConfigId).toBe('model-explicit');
    expect(result.apiKey).toBe('video-key');
    expect(modelConfigService.findDefaultByType).not.toHaveBeenCalled();
    expect(modelConfigService.getConfigForOrchestrator).toHaveBeenCalledWith(
      'model-explicit',
    );
    expect(repository.updateClipParams).not.toHaveBeenCalled();
  });

  it('falls back to the default video model and writes it back to clip params', async () => {
    const { resolver, repository, modelConfigService } = makeResolver({
      params: { resolution: '720p' },
    });

    const result = await resolver.resolveForGeneration({
      id: 'clip-1',
      params: { resolution: '720p' },
    });

    expect(modelConfigService.findDefaultByType).toHaveBeenCalledWith(
      ModelType.video,
    );
    expect(result.modelConfigId).toBe('model-default');
    expect(repository.updateClipParams).toHaveBeenCalledWith('clip-1', {
      resolution: '720p',
      modelConfigId: 'model-default',
    });
  });

  it('rejects generation when neither clip params nor a default video model exist', async () => {
    const { resolver } = makeResolver({ defaultModel: null });

    await expect(
      resolver.resolveForGeneration({ id: 'clip-1', params: {} }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
