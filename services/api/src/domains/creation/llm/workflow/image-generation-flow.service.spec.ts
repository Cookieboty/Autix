import { ModelType, PointHoldStatus } from '../../../platform/prisma/generated';
import { ImageGenerationFlowService } from './image-generation-flow.service';

const mockChatInvoke = jest.fn(async () => ({ content: 'refined prompt from llm' }));
class MockUpstreamParamsInvalidError extends Error {
  readonly code = 'UPSTREAM_PARAMS_INVALID';

  constructor(message: string) {
    super(message);
    this.name = 'UpstreamParamsInvalidError';
  }
}

function buildEndpoint(baseUrl: string, endpoint: string): string {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  if (normalizedBase.endsWith('/v1') && endpoint.startsWith('/v1/')) {
    return `${normalizedBase}${endpoint.slice(3)}`;
  }
  return `${normalizedBase}${endpoint}`;
}

async function assertOk(response: Response) {
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Image API ${response.status}: ${text.slice(0, 500)}`);
  }
}

function readImages(data: { data?: Array<{ b64_json?: string; url?: string }> }) {
  return (data.data ?? [])
    .map((item) =>
      item.b64_json ? `data:image/png;base64,${item.b64_json}` : item.url,
    )
    .filter((url): url is string => Boolean(url));
}

const mockImageGenerate = jest.fn(async (ctx: any) => {
  const isOpenAiOfficial = ctx.provider === 'openai-official';
  const isGptImage = /^gpt-image/i.test(ctx.model);
  const body: Record<string, unknown> = {
    model: ctx.model,
    prompt: ctx.prompt,
    n: ctx.count,
  };
  if (!isOpenAiOfficial || !isGptImage) body.response_format = 'b64_json';
  if (ctx.size && ctx.size !== 'auto') body.size = ctx.size;
  if (ctx.quality && ctx.quality !== 'auto') body.quality = ctx.quality;

  const response = await fetch(buildEndpoint(ctx.baseUrl, '/v1/images/generations'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ctx.apiKey}`,
    },
    body: JSON.stringify(body),
  });
  await assertOk(response as Response);
  return readImages(
    (await (response as Response).json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
    },
  );
});

const mockImageEdit = jest.fn(async (ctx: any) => {
  if (ctx.provider === 'openai-official' && !/^gpt-image/i.test(ctx.model)) {
    throw new MockUpstreamParamsInvalidError(
      `OpenAI image edit is only supported by gpt-image models; got model=${ctx.model}`,
    );
  }
  return mockImageGenerate(ctx);
});

jest.mock('../model.factory', () => ({
  createChatModelFromDbConfig: jest.fn(() => ({
    invoke: mockChatInvoke,
  })),
}));

jest.mock('@autix/ai-adapters/core', () => ({
  UPSTREAM_PARAMS_INVALID: 'UPSTREAM_PARAMS_INVALID',
  UpstreamParamsInvalidError: MockUpstreamParamsInvalidError,
}));

jest.mock('@autix/ai-adapters/image', () => ({
  resolveImageAdapter: jest.fn((provider?: string | null) => ({
    generate: (ctx: any) => mockImageGenerate({ ...ctx, provider }),
    edit: (ctx: any) => mockImageEdit({ ...ctx, provider }),
  })),
}));

function createService() {
  const prisma = {
    $transaction: jest.fn(async (callback: any) => callback(prisma)),
    messages: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    image_generations: {
      create: jest.fn(async (args: any) => ({ id: 'gen-1', ...args.data })),
      update: jest.fn(),
    },
    image_templates: {
      update: jest.fn(),
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
    estimateCost: jest.fn().mockResolvedValue({
      estimatedCost: 90,
      taskType: 'gpt_image_2_medium',
      pricingSnapshot: { ruleId: 'rule-1' },
      refundPolicy: { systemFailed: 'full_refund' },
    }),
    createHold: jest.fn().mockResolvedValue({
      hold: { id: 'hold-1' },
      balance: 910,
    }),
    confirmHold: jest.fn(),
    confirmHoldWithinTx: jest.fn(async () => ({
      confirmed: true,
      hold: { id: 'hold-1', userId: 'user-1', status: PointHoldStatus.CONFIRMED },
      balance: 820,
    })),
    refundHold: jest.fn(),
  };
  const inviteService = {
    settleInvitationOnFirstGeneration: jest.fn(async () => null),
  };
  const campaignRewardService = {
    recordSuccessGeneration: jest.fn(async () => ({ streak: null, rewards: [] })),
  };
  const systemPromptService = {
    render: jest.fn().mockResolvedValue({
      content:
        'You are an expert image prompt editor for a professional image workstation.',
    }),
  };
  return {
    service: new ImageGenerationFlowService(
      prisma as never,
      modelConfigService as never,
      imageTemplatesService as never,
      pointsService as never,
      inviteService as never,
      campaignRewardService as never,
      systemPromptService as never,
    ),
    prisma,
    modelConfigService,
    imageTemplatesService,
    pointsService,
    inviteService,
    campaignRewardService,
    systemPromptService,
  };
}

describe('ImageGenerationFlowService', () => {
  beforeEach(() => {
    mockChatInvoke.mockClear();
    mockImageGenerate.mockClear();
    mockImageEdit.mockClear();
  });

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

  it('skips hidden workbench tuning when skipPromptTuning is true', async () => {
    const { service, modelConfigService, imageTemplatesService } = createService();
    imageTemplatesService.findById.mockResolvedValue({
      id: 'tpl-1',
      prompt: '{{prompt}}',
      title: 'Workbench',
    });
    modelConfigService.getConfigForOrchestrator.mockResolvedValue({
      id: 'image-model-1',
      model: 'gpt-image-1',
      provider: 'openai-official',
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'key',
      metadata: {},
    });

    const request = await service.resolveImageRequest({
      userId: 'user-1',
      templateId: 'tpl-1',
      modelConfigId: 'image-model-1',
      chatModelId: 'chat-1',
      promptOverride: 'user confirmed prompt',
      settings: {
        promptTuning: '自动优化',
        skipPromptTuning: true,
      },
    });

    expect(request.prompt).toBe('user confirmed prompt');
    expect(modelConfigService.getConfigForOrchestrator).toHaveBeenCalledTimes(1);
  });

  it('refines workbench prompt without creating image generation records', async () => {
    const { service, modelConfigService, prisma, pointsService } = createService();
    pointsService.estimateCost.mockResolvedValueOnce({
      estimatedCost: 20,
      taskType: 'prompt_optimize_generation',
      pricingSnapshot: { ruleId: 'prompt-rule' },
      refundPolicy: { systemFailed: 'full_refund' },
    });
    modelConfigService.getConfigForOrchestrator.mockImplementation(async (id: string) => {
      if (id === 'image-model-1') {
        return {
          id,
          model: 'gpt-image-1',
          provider: 'openai-official',
          baseUrl: 'https://api.example.com/v1',
          apiKey: 'key',
          metadata: {},
          capabilities: ['image'],
        };
      }
      return {
        id,
        model: 'gpt-4o-mini',
        provider: 'openai-official',
        baseUrl: 'https://chat.example.com/v1',
        apiKey: 'key',
        metadata: {},
        capabilities: ['text', 'vision'],
      };
    });

    const result = await service.refineWorkbenchPrompt('user-1', {
      mode: 'generate',
      imageModelConfigId: 'image-model-1',
      chatModelId: 'chat-1',
      prompt: '手机海报',
      settings: {
        promptTuning: '电商卖点',
        stylePreset: '产品海报',
        negativePrompt: '低清晰度',
      },
      referenceImages: [{ url: 'data:image/png;base64,abc123' }],
    });

    expect(result.originalPrompt).toBe('手机海报');
    expect(result.composedPrompt).toContain('prompt tuning: 电商卖点');
    expect(result.composedPrompt).toContain('avoid: 低清晰度');
    expect(result.refinedPrompt).toBe('refined prompt from llm');
    expect(result.model).toBe('gpt-image-1');
    expect(result.chatModel).toBe('gpt-4o-mini');
    expect(prisma.image_generations.create).not.toHaveBeenCalled();
    expect(prisma.messages.create).not.toHaveBeenCalled();
    expect(pointsService.estimateCost).toHaveBeenCalledWith(
      expect.objectContaining({
        taskType: 'prompt_optimize_generation',
        modelProvider: 'openai-official',
        modelName: 'gpt-4o-mini',
        inputTokens: expect.any(Number),
        outputTokens: expect.any(Number),
      }),
    );
    expect(pointsService.createHold).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        taskType: 'prompt_optimize_generation',
        amount: 20,
        remark: '图片工作台 Prompt AI 优化 · openai-official/gpt-4o-mini',
      }),
    );
    expect(pointsService.confirmHold).toHaveBeenCalledWith('hold-1', 20);
  });

  it('refunds prompt optimization hold when prompt refinement fails', async () => {
    const { service, modelConfigService, pointsService } = createService();
    mockChatInvoke.mockRejectedValueOnce(new Error('llm failed'));
    pointsService.estimateCost.mockResolvedValueOnce({
      estimatedCost: 20,
      taskType: 'prompt_optimize_generation',
      pricingSnapshot: { ruleId: 'prompt-rule' },
      refundPolicy: { systemFailed: 'full_refund' },
    });
    modelConfigService.getConfigForOrchestrator.mockImplementation(async (id: string) => {
      if (id === 'image-model-1') {
        return {
          id,
          model: 'gpt-image-1',
          provider: 'openai-official',
          baseUrl: 'https://api.example.com/v1',
          apiKey: 'key',
          metadata: {},
          capabilities: ['image'],
        };
      }
      return {
        id,
        model: 'gpt-4o-mini',
        provider: 'openai-official',
        baseUrl: 'https://chat.example.com/v1',
        apiKey: 'key',
        metadata: {},
        capabilities: ['text', 'vision'],
      };
    });

    await expect(
      service.refineWorkbenchPrompt('user-1', {
        mode: 'generate',
        imageModelConfigId: 'image-model-1',
        chatModelId: 'chat-1',
        prompt: '手机海报',
        settings: { promptTuning: '自动优化' },
      }),
    ).rejects.toThrow('llm failed');

    expect(pointsService.createHold).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ taskType: 'prompt_optimize_generation' }),
    );
    expect(pointsService.refundHold).toHaveBeenCalledWith('hold-1', 'Prompt 优化失败');
    expect(pointsService.confirmHold).not.toHaveBeenCalled();
  });

  it('rejects prompt optimization when dynamic pricing is unavailable', async () => {
    const { service, modelConfigService, pointsService } = createService();
    pointsService.estimateCost.mockRejectedValueOnce(
      new Error('The table `public.generation_pricing_rules` does not exist'),
    );
    modelConfigService.getConfigForOrchestrator.mockImplementation(async (id: string) => {
      if (id === 'image-model-1') {
        return {
          id,
          model: 'gpt-image-1',
          provider: 'openai-official',
          baseUrl: 'https://api.example.com/v1',
          apiKey: 'key',
          metadata: {},
          capabilities: ['image'],
        };
      }
      return {
        id,
        model: 'gpt-4o-mini',
        provider: 'openai-official',
        baseUrl: 'https://chat.example.com/v1',
        apiKey: 'key',
        metadata: {},
        capabilities: ['text', 'vision'],
      };
    });

    await expect(
      service.refineWorkbenchPrompt('user-1', {
        mode: 'generate',
        imageModelConfigId: 'image-model-1',
        chatModelId: 'chat-1',
        prompt: '手机海报',
        settings: { promptTuning: '自动优化' },
      }),
    ).rejects.toThrow('generation_pricing_rules');

    expect(pointsService.createHold).not.toHaveBeenCalled();
    expect(pointsService.confirmHold).not.toHaveBeenCalled();
  });

  it('sends merged annotation images to prompt refinement LLM as multimodal content', async () => {
    const { service, modelConfigService } = createService();
    modelConfigService.getConfigForOrchestrator.mockImplementation(async (id: string) => {
      if (id === 'image-model-1') {
        return {
          id,
          model: 'gpt-image-1',
          provider: 'openai-official',
          baseUrl: 'https://api.example.com/v1',
          apiKey: 'key',
          metadata: {},
          capabilities: ['image'],
        };
      }
      return {
        id,
        model: 'gpt-4o',
        provider: 'openai-official',
        baseUrl: 'https://chat.example.com/v1',
        apiKey: 'key',
        metadata: {},
        capabilities: ['text', 'vision'],
      };
    });

    await service.refineWorkbenchPrompt('user-1', {
      mode: 'edit',
      imageModelConfigId: 'image-model-1',
      chatModelId: 'chat-vision-1',
      prompt: '把标注区域改成蓝色背景',
      sourceImages: [
        {
          url: 'data:image/png;base64,MERGED_IMAGE',
          prompt: '【标注说明】处理画面中部。',
        },
      ],
      settings: {
        promptTuning: '自动优化',
        stylePreset: '通用精修',
      },
    });

    const lastInvokeCall = mockChatInvoke.mock.calls.at(-1) as unknown as [Array<{ content: unknown }>];
    const messages = lastInvokeCall[0];
    const humanContent = messages[1].content as Array<{ type: string; text?: string; image_url?: { url: string } }>;
    expect(Array.isArray(humanContent)).toBe(true);
    expect(humanContent).toContainEqual({
      type: 'image_url',
      image_url: { url: 'data:image/png;base64,MERGED_IMAGE' },
    });
    expect(JSON.stringify(humanContent)).not.toContain('OVERLAY');
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

  it('freezes configurable image points before provider call and confirms after persistence', async () => {
    const { service, prisma, pointsService } = createService();
    const order: string[] = [];
    pointsService.createHold.mockImplementation(async () => {
      order.push('hold');
      return { hold: { id: 'hold-1' }, balance: 910 };
    });
    pointsService.confirmHoldWithinTx.mockImplementation(async () => {
      order.push('confirm');
      return {
        confirmed: true,
        hold: { id: 'hold-1', userId: 'user-1', status: PointHoldStatus.CONFIRMED },
        balance: 820,
      };
    });
    prisma.image_generations.create.mockImplementation(async (args: any) => {
      order.push('image_record');
      return { id: 'gen-1', ...args.data };
    });
    jest.spyOn(service, 'callImageApi').mockImplementation(async () => {
      order.push('provider');
      return {
        images: ['data:image/png;base64,AAA'],
        appliedSettings: {
          size: '1024x1024',
          quality: 'high',
          count: 2,
          coerced: false,
          notes: [],
          kind: 'gpt-image',
        },
      };
    });
    jest.spyOn(service, 'uploadGeneratedImages').mockImplementation(async () => {
      order.push('upload');
      return ['https://cdn.test/1.png', 'https://cdn.test/2.png'];
    });
    const originalPersist = service.persistImageResult.bind(service);
    jest.spyOn(service, 'persistImageResult').mockImplementation(async (...args) => {
      order.push('persist');
      return originalPersist(...args);
    });

    const result = await service.generateAndPersistImage(
      {
        userId: 'user-1',
        templateId: 'tpl-1',
        modelConfigId: 'image-model-1',
        settings: { quality: 'high', size: '1024x1024' },
      },
      {
        mode: 'generate',
        prompt: 'A scene',
        modelConfig: {
          id: 'image-model-1',
          model: 'gpt-image-2',
          provider: 'openai-official',
          baseUrl: 'https://api.example.com/v1',
          apiKey: 'key',
        },
        template: {},
        variables: {},
        settings: { quality: 'high', size: '1024x1024' },
        referenceImages: [{ url: 'https://img.test/ref.png' }],
      },
      2,
    );

    expect(pointsService.estimateCost).toHaveBeenCalledWith(
      expect.objectContaining({
        taskType: 'gpt_image_2_high',
        quantity: 2,
        referenceImages: 1,
        quality: 'high',
        resolution: '1024x1024',
      }),
    );
    expect(pointsService.createHold).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        amount: 90,
        taskType: 'gpt_image_2_medium',
        pricingSnapshot: { ruleId: 'rule-1' },
      }),
    );
    expect(pointsService.confirmHoldWithinTx).toHaveBeenCalledWith(
      expect.any(Object),
      'hold-1',
    );
    expect(pointsService.refundHold).not.toHaveBeenCalled();
    expect(order).toEqual(['hold', 'provider', 'upload', 'persist', 'confirm', 'image_record']);
    expect(result.prompt).toBe('A scene');
  });

  it('refunds image hold when provider call fails', async () => {
    const { service, pointsService } = createService();
    jest.spyOn(service, 'callImageApi').mockRejectedValue(new Error('provider down'));
    const persistSpy = jest.spyOn(service, 'persistImageResult');

    await expect(
      service.generateAndPersistImage(
        {
          userId: 'user-1',
          templateId: 'tpl-1',
          modelConfigId: 'image-model-1',
        },
        {
          mode: 'generate',
          prompt: 'A scene',
          modelConfig: {
            id: 'image-model-1',
            model: 'gpt-image-2',
            provider: 'openai-official',
            baseUrl: 'https://api.example.com/v1',
            apiKey: 'key',
          },
          template: {},
          variables: {},
        },
        1,
      ),
    ).rejects.toThrow('provider down');

    expect(pointsService.createHold).toHaveBeenCalled();
    expect(pointsService.refundHold).toHaveBeenCalledWith('hold-1', '图片生成失败');
    expect(pointsService.confirmHold).not.toHaveBeenCalled();
    expect(persistSpy).not.toHaveBeenCalled();
  });

  it('does not persist completed images when point confirmation fails', async () => {
    const { service, prisma, pointsService } = createService();
    jest.spyOn(service, 'callImageApi').mockResolvedValue({
      images: ['https://img.test/1.png'],
      appliedSettings: {
        size: '1024x1024',
        quality: 'medium',
        count: 1,
        coerced: false,
        notes: [],
        kind: 'gpt-image',
      },
    });
    jest.spyOn(service, 'uploadGeneratedImages').mockResolvedValue(['https://img.test/1.png']);
    pointsService.confirmHoldWithinTx.mockRejectedValue(new Error('ledger confirm failed'));

    await expect(
      service.generateAndPersistImage(
        {
          userId: 'user-1',
          templateId: 'tpl-1',
          modelConfigId: 'image-model-1',
        },
        {
          mode: 'generate',
          prompt: 'A scene',
          modelConfig: {
            id: 'image-model-1',
            model: 'gpt-image-2',
            provider: 'openai-official',
            baseUrl: 'https://api.example.com/v1',
            apiKey: 'key',
          },
          template: {},
          variables: {},
        },
        1,
      ),
    ).rejects.toThrow('ledger confirm failed');

    expect(prisma.image_generations.create).not.toHaveBeenCalled();
    expect(pointsService.refundHold).toHaveBeenCalledWith('hold-1', '图片生成失败');
  });

  it('skips platform points for user-owned image models', async () => {
    const { service, pointsService } = createService();
    jest.spyOn(service, 'callImageApi').mockResolvedValue({
      images: ['https://img.test/1.png'],
      appliedSettings: {
        size: '1024x1024',
        quality: 'medium',
        count: 1,
        coerced: false,
        notes: [],
        kind: 'gpt-image',
      },
    });
    jest.spyOn(service, 'uploadGeneratedImages').mockResolvedValue(['https://img.test/1.png']);
    jest.spyOn(service, 'persistImageResult').mockResolvedValue({
      generation: { id: 'gen-1' },
      images: [
        {
          url: 'https://img.test/1.png',
          index: 0,
          generationId: 'gen-1',
          prompt: 'A scene',
        },
      ],
    });

    await service.generateAndPersistImage(
      {
        userId: 'user-1',
        templateId: 'tpl-1',
        modelConfigId: 'image-model-1',
      },
      {
        mode: 'generate',
        prompt: 'A scene',
        modelConfig: {
          id: 'image-model-1',
          model: 'custom-image',
          createdBy: 'user-1',
        },
        template: {},
        variables: {},
      },
      1,
    );

    expect(pointsService.estimateCost).not.toHaveBeenCalled();
    expect(pointsService.createHold).not.toHaveBeenCalled();
    expect(pointsService.confirmHold).not.toHaveBeenCalled();
  });
});
