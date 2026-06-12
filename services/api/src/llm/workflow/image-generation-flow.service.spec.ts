import { ModelType } from '../../prisma/generated';
import { ImageGenerationFlowService } from './image-generation-flow.service';

function createService() {
  const prisma = {
    messages: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    image_generations: {
      create: jest.fn(),
      update: jest.fn(),
    },
    image_templates: {
      update: jest.fn(),
    },
    task_point_costs: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  };
  const modelConfigService = {
    findDefaultByType: jest.fn(),
    getConfigForOrchestrator: jest.fn(),
  };
  const imageTemplatesService = {
    findById: jest.fn(),
    uploadBase64Image: jest.fn(),
  };
  const pointsService = {
    deductPoints: jest.fn(),
  };
  return {
    service: new ImageGenerationFlowService(
      prisma as never,
      modelConfigService as never,
      imageTemplatesService as never,
      pointsService as never,
    ),
    prisma,
    modelConfigService,
    imageTemplatesService,
    pointsService,
  };
}

describe('ImageGenerationFlowService', () => {
  it('builds a compact image conversation summary from relevant metadata', () => {
    const { service } = createService();

    const summary = service.buildConversationSummary([
      {
        role: 'USER',
        content: '我想要更有科技感，背景是蓝紫渐变',
        metadata: null,
      },
      {
        role: 'ASSISTANT',
        content: '当然可以，我来帮你分析一下需求。',
        metadata: { messageType: 'markdown' },
      },
      {
        role: 'ASSISTANT',
        content: 'Prompt suggestion',
        metadata: {
          messageType: 'prompt_suggestion',
          prompt: 'A futuristic product photo with blue purple gradient',
        },
      },
      {
        role: 'ASSISTANT',
        content: 'Image result',
        metadata: {
          messageType: 'image_result',
          prompt: 'A product photo',
          images: [{ url: 'https://img.test/1.png', prompt: 'A product photo' }],
        },
      },
    ]);

    expect(summary).toContain('我想要更有科技感');
    expect(summary).toContain('A futuristic product photo');
    expect(summary).toContain('https://img.test/1.png');
    expect(summary).not.toContain('当然可以');
  });

  it('uses promptOverride without calling the summary model', async () => {
    const { service, modelConfigService, imageTemplatesService } = createService();
    imageTemplatesService.findById.mockResolvedValue({
      id: 'tpl-1',
      prompt: 'Create {{style}} image',
      title: 'Template',
    });
    modelConfigService.getConfigForOrchestrator.mockResolvedValue({
      id: 'image-model-1',
      model: 'gpt-image-2',
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'key',
      metadata: {},
    });

    const request = await service.resolveImageRequest({
      userId: 'user-1',
      conversationId: 'conv-1',
      templateId: 'tpl-1',
      modelConfigId: 'image-model-1',
      variables: { style: 'modern' },
      promptOverride: 'edited prompt',
    });

    expect(request.mode).toBe('generate');
    expect(request.prompt).toBe('edited prompt');
    expect(modelConfigService.findDefaultByType).not.toHaveBeenCalledWith(ModelType.general);
  });

  it('builds edit requests when source images are present', async () => {
    const { service, modelConfigService, imageTemplatesService, prisma } = createService();
    imageTemplatesService.findById.mockResolvedValue({
      id: 'tpl-1',
      prompt: 'Create {{style}} image',
      title: 'Template',
    });
    prisma.messages.findMany.mockResolvedValue([]);
    modelConfigService.findDefaultByType.mockResolvedValue({
      id: 'general-1',
      model: 'gpt-4o',
      baseUrl: 'https://chat.example.com/v1',
      apiKey: 'key',
    });
    modelConfigService.getConfigForOrchestrator.mockResolvedValue({
      id: 'image-model-1',
      model: 'gpt-image-2',
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'key',
      metadata: { imageToImageEndpoint: '/v1/images/edits' },
    });
    service.summarizePrompt = jest.fn().mockResolvedValue('preserve product, change background');

    const request = await service.resolveImageRequest({
      userId: 'user-1',
      conversationId: 'conv-1',
      templateId: 'tpl-1',
      modelConfigId: 'image-model-1',
      variables: { style: 'modern' },
      sourceImages: [{ url: 'https://img.test/1.png', prompt: 'original prompt' }],
      editInstruction: '换成蓝色背景',
    });

    expect(request.mode).toBe('edit');
    expect(request.prompt).toBe('preserve product, change background');
    expect(request.sourceImages).toEqual([
      { url: 'https://img.test/1.png', prompt: 'original prompt' },
    ]);
    expect(service.summarizePrompt).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'edit' }),
    );
  });

  it('keeps pasted reference images in generate mode', async () => {
    const { service, modelConfigService, imageTemplatesService, prisma } = createService();
    imageTemplatesService.findById.mockResolvedValue({
      id: 'tpl-1',
      prompt: 'Create {{style}} image',
      title: 'Template',
    });
    prisma.messages.findMany.mockResolvedValue([]);
    modelConfigService.getConfigForOrchestrator.mockResolvedValue({
      id: 'image-model-1',
      model: 'gpt-image-2',
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'key',
      metadata: {},
    });
    service.summarizePrompt = jest.fn().mockResolvedValue('use reference style to create a new image');

    const request = await service.resolveImageRequest({
      userId: 'user-1',
      conversationId: 'conv-1',
      templateId: 'tpl-1',
      modelConfigId: 'image-model-1',
      variables: { style: 'modern' },
      referenceImages: [{ url: 'https://img.test/reference.png' }],
    });

    expect(request.mode).toBe('generate');
    expect(request.referenceImages).toEqual([
      { url: 'https://img.test/reference.png' },
    ]);
    expect(service.summarizePrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'generate',
        referenceImages: [{ url: 'https://img.test/reference.png' }],
      }),
    );
  });

  it('uploads generated base64 images under the amux-studio prefix', async () => {
    const { service, imageTemplatesService } = createService();
    imageTemplatesService.uploadBase64Image.mockResolvedValue(
      'https://cdn.test/amux-studio/image-generations/1.png',
    );

    await service.uploadGeneratedImage('data:image/png;base64,abc123');

    expect(imageTemplatesService.uploadBase64Image).toHaveBeenCalledWith(
      'data:image/png;base64,abc123',
      'amux-studio/image-generations',
    );
  });

  it('includes image generation settings in API request body', async () => {
    const { service } = createService();
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ url: 'https://img.test/1.png' }] }),
    }) as never;

    const result = await service.callImageApi(
      {
        mode: 'generate',
        prompt: 'A scene',
        modelConfig: {
          id: 'image-model-1',
          model: 'gpt-image-2',
          baseUrl: 'https://api.example.com/v1',
          apiKey: 'key',
          metadata: {},
        },
        template: {},
        variables: {},
        settings: {
          size: '1024x1024',
          quality: 'high',
        },
      },
      2,
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/v1/images/generations',
      expect.objectContaining({
        body: JSON.stringify({
          model: 'gpt-image-2',
          prompt: 'A scene',
          n: 2,
          response_format: 'b64_json',
          size: '1024x1024',
          quality: 'high',
        }),
      }),
    );
    expect(result.images).toEqual(['https://img.test/1.png']);
    expect(result.appliedSettings.coerced).toBe(false);
    expect(result.appliedSettings.count).toBe(2);
    expect(result.appliedSettings.kind).toBe('gpt-image');

    global.fetch = originalFetch;
  });

  it('coerces oversized count and surfaces appliedSettings.coerced=true', async () => {
    const { service } = createService();
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ url: 'https://img.test/1.png' }] }),
    }) as never;

    const result = await service.callImageApi(
      {
        mode: 'generate',
        prompt: 'A scene',
        modelConfig: {
          id: 'image-model-1',
          model: 'gpt-image-1',
          provider: 'openai-official',
          baseUrl: 'https://api.example.com/v1',
          apiKey: 'key',
          metadata: {},
        },
        template: {},
        variables: {},
        settings: { size: '1024x1024', quality: 'high' },
      },
      99,
    );

    expect(result.appliedSettings.coerced).toBe(true);
    expect(result.appliedSettings.count).toBe(4);
    expect(result.appliedSettings.notes.join(';')).toContain('count');

    global.fetch = originalFetch;
  });

  it('retries with SAFE_DEFAULTS on upstream 4xx and returns coerced=true', async () => {
    const { service } = createService();
    const originalFetch = global.fetch;
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => '{"error":{"message":"invalid size"}}',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ b64_json: 'AAA' }] }),
      });
    global.fetch = fetchMock as never;

    const result = await service.callImageApi(
      {
        mode: 'generate',
        prompt: 'A scene',
        modelConfig: {
          id: 'image-model-1',
          model: 'gpt-image-1',
          provider: 'openai-official',
          baseUrl: 'https://api.example.com/v1',
          apiKey: 'key',
          metadata: {},
        },
        template: {},
        variables: {},
        settings: { size: '1024x1024', quality: 'high' },
      },
      2,
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.images).toEqual(['data:image/png;base64,AAA']);
    expect(result.appliedSettings.coerced).toBe(true);
    expect(result.appliedSettings.count).toBe(1);
    expect(result.appliedSettings.size).toBe('auto');
    expect(result.appliedSettings.notes.join(';')).toContain('fallback');

    global.fetch = originalFetch;
  });

  it('throws ERR_IMAGE_PARAMS_NOT_SUPPORTED on consecutive upstream 4xx', async () => {
    const { service } = createService();
    const originalFetch = global.fetch;
    global.fetch = jest
      .fn()
      .mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => '{"error":{"message":"persistently invalid"}}',
      }) as never;

    let captured: { status?: number; response?: unknown } | undefined;
    try {
      await service.callImageApi(
        {
          mode: 'generate',
          prompt: 'A scene',
          modelConfig: {
            id: 'image-model-1',
            model: 'gpt-image-1',
            provider: 'openai-official',
            baseUrl: 'https://api.example.com/v1',
            apiKey: 'key',
            metadata: {},
          },
          template: {},
          variables: {},
          settings: { size: '1024x1024', quality: 'high' },
        },
        1,
      );
    } catch (err) {
      captured = {
        status: (err as { status?: number }).status,
        response: (err as { response?: unknown }).response,
      };
    }

    expect(captured).toBeDefined();
    expect(captured?.status).toBe(400);
    const response = captured?.response as { errorCode?: string; message?: string } | undefined;
    expect(response?.errorCode).toBe('ERR_IMAGE_PARAMS_NOT_SUPPORTED');
    expect(response?.message).toContain('当前模型不支持所选参数');

    global.fetch = originalFetch;
  });

  it('maps UpstreamParamsInvalidError to ERR_IMAGE_PARAMS_NOT_SUPPORTED after retry exhaustion', async () => {
    const { service } = createService();
    const originalFetch = global.fetch;
    // Edit mode on a non-gpt-image model → OpenAI adapter throws
    // UpstreamParamsInvalidError synchronously; the retry uses safe defaults
    // (still non-gpt-image), which also throws, so we expect the typed error
    // to be mapped to the stable Chinese error code.
    global.fetch = jest.fn() as never; // should never be invoked

    let captured: { status?: number; response?: unknown } | undefined;
    try {
      await service.callImageApi(
        {
          mode: 'edit',
          prompt: 'edit it',
          modelConfig: {
            id: 'image-model-1',
            model: 'sdxl-base-1.0',
            provider: 'openai-official',
            baseUrl: 'https://api.example.com/v1',
            apiKey: 'key',
            metadata: {},
          },
          template: {},
          variables: {},
          sourceImages: [{ url: 'https://img.test/source.png' }],
          settings: { size: '1024x1024' },
        },
        1,
      );
    } catch (err) {
      captured = {
        status: (err as { status?: number }).status,
        response: (err as { response?: unknown }).response,
      };
    }

    expect(captured).toBeDefined();
    expect(captured?.status).toBe(400);
    const response = captured?.response as { errorCode?: string } | undefined;
    expect(response?.errorCode).toBe('ERR_IMAGE_PARAMS_NOT_SUPPORTED');
    expect(global.fetch).not.toHaveBeenCalled();

    global.fetch = originalFetch;
  });
});
