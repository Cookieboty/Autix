import { VideoGenerationModelResolverService } from './video-generation-model-resolver.service';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';

function makeResolver(options: {
  apiKey?: string | null;
  baseUrl?: string | null;
} = {}) {
  const modelConfigService = {
    getConfigForOrchestrator: vi.fn(async (id: string) => ({
      id,
      model: 'seedance-pro',
      baseUrl: options.baseUrl === undefined ? 'https://seedance.test' : options.baseUrl,
      apiKey: options.apiKey === undefined ? 'video-key' : options.apiKey,
    })),
  };

  const resolver = new VideoGenerationModelResolverService(
    modelConfigService as never,
  );

  return { resolver, modelConfigService };
}

describe('VideoGenerationModelResolverService', () => {
  it('uses the clip model config that the frontend selected', async () => {
    const { resolver, modelConfigService } = makeResolver();

    const result = await resolver.resolveForGeneration({
      id: 'clip-1',
      params: { modelConfigId: 'model-explicit' },
    }, 'user-1');

    expect(result.modelConfigId).toBe('model-explicit');
    expect(result.apiKey).toBe('video-key');
    expect(result.baseUrl).toBe('https://seedance.test');
    expect(modelConfigService.getConfigForOrchestrator).toHaveBeenCalledWith(
      'model-explicit',
      'user-1',
    );
  });

  it('rejects generation when the clip carries no modelConfigId — 无兜底，不回退默认模型', async () => {
    const { resolver, modelConfigService } = makeResolver();

    await expect(
      resolver.resolveForGeneration({ id: 'clip-1', params: {} }),
    ).rejects.toBeInstanceOf(I18nHttpException);
    // 关键：不再查询/回退任何「默认视频模型」
    expect(modelConfigService.getConfigForOrchestrator).not.toHaveBeenCalled();
  });
});
