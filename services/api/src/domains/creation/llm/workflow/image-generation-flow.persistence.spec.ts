import { buildCompletedImageGenerationRepositoryInput } from './image-generation-flow.persistence';
import type { AppliedImageSettings, ResolvedImageRequest } from './image-generation-call-params';

describe('image generation flow persistence', () => {
  const request: ResolvedImageRequest = {
    mode: 'generate',
    prompt: 'a prompt',
    modelConfig: {
      id: 'image-model-1',
      model: 'gpt-image-2',
    },
    template: {},
    variables: {},
    settings: {},
  };

  function buildAppliedSettings(
    overrides: Partial<AppliedImageSettings> = {},
  ): AppliedImageSettings {
    return {
      size: '1024x768',
      quality: 'medium',
      count: 1,
      coerced: false,
      notes: [],
      kind: 'gpt-image',
      ...overrides,
    };
  }

  function build(appliedSettings: AppliedImageSettings) {
    return buildCompletedImageGenerationRepositoryInput({
      requestInput: {
        templateId: 'tpl-1',
        userId: 'user-1',
        modelConfigId: 'image-model-1',
      },
      request,
      images: ['https://cdn.test/1.png'],
      durationMs: 1234,
      appliedSettings,
    });
  }

  it('持久化写入最终 appliedSettings 解析的 width/height；size=auto → null', () => {
    const gen = build(buildAppliedSettings({ size: '1024x768' }));
    expect(gen.width).toBe(1024);
    expect(gen.height).toBe(768);

    const g2 = build(buildAppliedSettings({ size: 'auto' }));
    expect(g2.width).toBeNull();
    expect(g2.height).toBeNull();
  });

  it('不可解析的 size（如带 @1K 后缀的组合格式）→ width/height 均为 null', () => {
    const gen = build(buildAppliedSettings({ size: '1024x1024@1K' }));
    expect(gen.width).toBeNull();
    expect(gen.height).toBeNull();
  });

  it('appliedSettings 缺失 size → width/height 均为 null', () => {
    const gen = build(buildAppliedSettings({ size: undefined }));
    expect(gen.width).toBeNull();
    expect(gen.height).toBeNull();
  });

  it('appliedSettings 未提供时不写入的 width/height 仍为 null（避免回读请求值）', () => {
    const gen = buildCompletedImageGenerationRepositoryInput({
      requestInput: {
        templateId: 'tpl-1',
        userId: 'user-1',
        modelConfigId: 'image-model-1',
      },
      request,
      images: ['https://cdn.test/1.png'],
      durationMs: 1234,
    } as Parameters<typeof buildCompletedImageGenerationRepositoryInput>[0]);
    expect(gen.width).toBeNull();
    expect(gen.height).toBeNull();
  });
});
