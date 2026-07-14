import { ModelType, PointHoldStatus } from '../../../platform/prisma/generated';
import { ImageGenerationFlowService } from './image-generation-flow.service';

const mockChatInvoke = jest.fn(async () => ({ content: 'refined prompt from llm' }));

jest.mock('../model.factory', () => ({
  createChatModelFromDbConfig: jest.fn(() => ({
    invoke: mockChatInvoke,
  })),
}));

// **不再 mock `@autix/ai-adapters/image`**：图片调用现在跑真正的 protocol 引擎
// （resolveImagePreset + executeImageCall），只把 `global.fetch` 打桩。这样这些用例
// 断言的是「真正发出去的 HTTP 请求体」，而不是一个手写 mock adapter 对协议的复述 ——
// 老 mock 自己重新实现了一遍 kind 嗅探与 body 拼装，它绿不代表线上对。

/** 第 2 期翻转后的图片 paramsSchema（seed-pricing.schemas.ts 的形状）。 */
const IMAGE_PARAMS_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['size', 'quality', 'resolution'],
  properties: {
    size: {
      type: 'string',
      enum: ['1024x1024@1K', '2048x2048@2K'],
      default: '1024x1024@1K',
      'x-ui': { role: 'wire', control: 'size-grid' },
    },
    quality: {
      type: 'string',
      enum: ['low', 'medium', 'high'],
      default: 'medium',
      'x-ui': { role: 'both', control: 'chips' },
    },
    resolution: {
      type: 'string',
      enum: ['1K', '2K'],
      default: '1K',
      'x-ui': {
        role: 'derived',
        control: 'hidden',
        derivedFrom: { param: 'size', via: 'imagePricingResolution' },
      },
    },
    referenceImages: {
      type: 'integer',
      minimum: 0,
      default: 0,
      'x-ui': { role: 'pricing', control: 'hidden' },
    },
    seed: { type: 'string', 'x-ui': { role: 'wire', control: 'hidden' } },
  },
};

const IMAGE_MODEL_CONFIG = {
  id: 'image-model-1',
  model: 'gemini-3-pro-image',
  provider: 'openai-compatible',
  baseUrl: 'https://api.example.com/v1',
  apiKey: 'key',
  metadata: {
    protocolKey: 'openai-images@v1',
    operations: ['generate', 'edit'],
    limits: { maxCount: 4 },
  },
  paramsSchema: IMAGE_PARAMS_SCHEMA,
};

function imageRequest(overrides: Record<string, unknown> = {}) {
  return {
    mode: 'generate',
    prompt: 'A scene',
    modelConfig: IMAGE_MODEL_CONFIG,
    template: {},
    variables: {},
    ...overrides,
  } as never;
}

/** 读出打桩 fetch 收到的 JSON 请求体。 */
function sentBody(fetchMock: jest.Mock, call = 0): Record<string, unknown> {
  const init = fetchMock.mock.calls[call][1] as { body: string };
  return JSON.parse(init.body) as Record<string, unknown>;
}

function okJson(payload: unknown) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => payload,
  };
}

function upstreamError(status: number, body: string) {
  return {
    ok: false,
    status,
    headers: { get: () => null },
    text: async () => body,
  };
}

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
  const repository = {
    findAllConversationMessages: jest.fn((conversationId: string) =>
      prisma.messages.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
      }),
    ),
    createCompletedImageGenerationResult: jest.fn(
      async (input: any, beforeCreate?: (tx: any) => Promise<void>) =>
        prisma.$transaction(async (tx: typeof prisma) => {
          await beforeCreate?.(tx);
          const generation = await tx.image_generations.create({
            data: {
              templateId: input.templateId,
              userId: input.userId,
              modelUsed: input.modelUsed,
              resolvedPrompt: input.resolvedPrompt,
              variables: input.variables,
              referenceImage: input.referenceImage,
              generatedImages: input.generatedImages,
              status: 'completed',
              durationMs: input.durationMs,
            },
          });
          await tx.image_templates.update({
            where: { id: input.templateId },
            data: { useCount: { increment: 1 } },
          });
          const imageItems = input.buildImageItems(generation.id);
          if (input.conversationId) {
            await tx.messages.create({
              data: {
                conversationId: input.conversationId,
                role: 'ASSISTANT',
                content: input.conversationContent,
                metadata: input.buildMessageMetadata(generation.id, imageItems),
              },
            });
          }
          return { generation, imageItems };
        }),
    ),
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
      taskType: 'image_generation',
      pricingSnapshot: { ruleId: 'rule-1' },
    }),
    createHold: jest.fn().mockResolvedValue({
      hold: { id: 'hold-1' },
      balance: 910,
    }),
    confirmHold: jest.fn(),
    quoteHoldFromSnapshot: jest.fn().mockResolvedValue(90),
    confirmHoldWithinTx: jest.fn(async () => ({
      confirmed: true,
      hold: { id: 'hold-1', userId: 'user-1', status: PointHoldStatus.CONFIRMED },
      balance: 820,
    })),
    refundHold: jest.fn(),
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
  const membershipService = {
    resolveActiveMembershipLevel: jest.fn().mockResolvedValue(2),
    resolveImageEntitlements: jest.fn().mockResolvedValue({
      enabled: true,
      maxPixels: 4096 * 4096,
      allowedQualities: [],
      concurrency: 1,
      levelName: 'Creator',
      level: 2,
      source: 'membership',
    }),
    assertImageEntitlement: jest.fn(),
  };
  return {
    service: new ImageGenerationFlowService(
      repository as never,
      modelConfigService as never,
      imageTemplatesService as never,
      pointsService as never,
      campaignRewardService as never,
      systemPromptService as never,
      membershipService as never,
    ),
    prisma,
    repository,
    modelConfigService,
    imageTemplatesService,
    pointsService,
    campaignRewardService,
    systemPromptService,
    membershipService,
  };
}

describe('ImageGenerationFlowService', () => {
  beforeEach(() => {
    mockChatInvoke.mockClear();
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
    });
    pointsService.quoteHoldFromSnapshot.mockResolvedValueOnce(20);
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
    expect(pointsService.estimateCost).toHaveBeenCalledWith({
      taskType: 'prompt_optimize_generation',
      modelConfigId: 'chat-1',
      params: {},
      usage: { inputTokens: expect.any(Number), outputTokens: expect.any(Number) },
      membershipLevel: 2,
    });
    expect(pointsService.createHold).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        taskType: 'prompt_optimize_generation',
        amount: 20,
        remark: '图片工作台 Prompt AI 优化 · openai-official/gpt-4o-mini',
      }),
    );
    // Task 13: settlement re-prices from the frozen hold snapshot, not by
    // calling estimateCost() again.
    expect(pointsService.estimateCost).toHaveBeenCalledTimes(1);
    expect(pointsService.quoteHoldFromSnapshot).toHaveBeenCalledWith(
      'hold-1',
      expect.objectContaining({ outputTokens: expect.any(Number) }),
    );
    expect(pointsService.confirmHold).toHaveBeenCalledWith('hold-1', 20);
  });

  it('falls back to a plain confirmHold when settlement quoteHoldFromSnapshot throws (no re-estimate fallback)', async () => {
    const { service, modelConfigService, pointsService } = createService();
    pointsService.estimateCost.mockResolvedValueOnce({
      estimatedCost: 20,
      taskType: 'prompt_optimize_generation',
      pricingSnapshot: { ruleId: 'prompt-rule' },
    });
    pointsService.quoteHoldFromSnapshot.mockRejectedValueOnce(new Error('缺少快照'));
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

    await service.refineWorkbenchPrompt('user-1', {
      mode: 'generate',
      imageModelConfigId: 'image-model-1',
      chatModelId: 'chat-1',
      prompt: '手机海报',
      settings: { promptTuning: '自动优化' },
    });

    expect(pointsService.estimateCost).toHaveBeenCalledTimes(1);
    expect(pointsService.confirmHold).toHaveBeenCalledWith('hold-1');
  });

  it('refunds prompt optimization hold when prompt refinement fails', async () => {
    const { service, modelConfigService, pointsService } = createService();
    mockChatInvoke.mockRejectedValueOnce(new Error('llm failed'));
    pointsService.estimateCost.mockResolvedValueOnce({
      estimatedCost: 20,
      taskType: 'prompt_optimize_generation',
      pricingSnapshot: { ruleId: 'prompt-rule' },
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
      new Error('No active pricing configuration for this task'),
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
    ).rejects.toThrow('pricing configuration');

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

  it('sends the wire params in the request body and reports what was actually sent', async () => {
    const { service } = createService();
    const originalFetch = global.fetch;
    const fetchMock = jest.fn().mockResolvedValue(
      okJson({ data: [{ url: 'https://img.test/1.png' }] }),
    );
    global.fetch = fetchMock as never;

    const result = await service.callImageApi(
      imageRequest({ settings: { size: '1024x1024@1K', quality: 'high' } }),
      2,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.com/v1/images/generations');
    expect(sentBody(fetchMock)).toEqual({
      response_format: 'b64_json',
      model: 'gemini-3-pro-image',
      prompt: 'A scene',
      n: 2,
      size: '1024x1024',
      quality: 'high',
    });
    expect(result.images).toEqual(['https://img.test/1.png']);
    // appliedSettings = 真正发出去的值（§4.4）：size 已被 preset 剥掉 @tier 后缀。
    expect(result.appliedSettings).toEqual({
      size: '1024x1024',
      quality: 'high',
      count: 2,
      coerced: false,
      notes: [],
    });

    global.fetch = originalFetch;
  });

  it('strips the @tier suffix before it reaches the upstream (the Nano Banana fix)', async () => {
    const { service } = createService();
    const originalFetch = global.fetch;
    const fetchMock = jest.fn().mockResolvedValue(okJson({ data: [{ b64_json: 'AAA' }] }));
    global.fetch = fetchMock as never;

    const result = await service.callImageApi(
      imageRequest({ settings: { size: '2048x2048@2K', quality: 'high' } }),
      1,
    );

    // 老 kind 嗅探把 `2048x2048@2K` 原样发给不认识 @tier 的端点 → 400 → 「重试 safe
    // defaults」（同一个 1024x1024@1K，从没修好过任何东西）。preset 的 stripTierSuffix
    // 从根上消除了这个失败模式。
    expect(sentBody(fetchMock).size).toBe('2048x2048');
    expect(result.appliedSettings.size).toBe('2048x2048');
    expect(result.images).toEqual(['data:image/png;base64,AAA']);

    global.fetch = originalFetch;
  });

  it('never sends derived / pricing-only / undeclared params upstream', async () => {
    const { service } = createService();
    const originalFetch = global.fetch;
    const fetchMock = jest.fn().mockResolvedValue(okJson({ data: [{ b64_json: 'AAA' }] }));
    global.fetch = fetchMock as never;

    const result = await service.callImageApi(
      imageRequest({
        settings: {
          size: '1024x1024@1K',
          quality: 'high',
          resolution: '4K',        // role: derived —— 客户端伪造的计价值绝不上线
          referenceImages: 3,      // role: pricing —— 上游要的是图本身，不是「几张」这个数
          promptTuning: '自动优化', // schema 未声明 —— 白名单丢弃
          skipPromptTuning: true,
          stylePreset: 'cinematic',
        },
      }),
      1,
    );

    const body = sentBody(fetchMock);
    expect(body).not.toHaveProperty('resolution');
    expect(body).not.toHaveProperty('referenceImages');
    expect(body).not.toHaveProperty('promptTuning');
    expect(body).not.toHaveProperty('skipPromptTuning');
    expect(body).not.toHaveProperty('stylePreset');
    expect(result.appliedSettings).not.toHaveProperty('resolution');
    expect(result.appliedSettings).not.toHaveProperty('promptTuning');

    global.fetch = originalFetch;
  });

  it('does NOT retry a params 4xx: throws ERR_IMAGE_PARAMS_NOT_SUPPORTED after exactly one upstream call', async () => {
    const { service } = createService();
    const originalFetch = global.fetch;
    // 行为变更：4xx → safe-defaults 重试整条删除。重试用的 safe defaults 仍是同一组参数，
    // 它从来没修好过任何东西，只是把上游多打了一次。
    const fetchMock = jest
      .fn()
      .mockResolvedValue(upstreamError(400, '{"error":{"message":"invalid size"}}'));
    global.fetch = fetchMock as never;

    let captured: { status?: number; response?: unknown } | undefined;
    try {
      await service.callImageApi(
        imageRequest({ settings: { size: '1024x1024@1K', quality: 'high' } }),
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
    const response = captured?.response as
      | { errorCode?: string; message?: string; details?: Record<string, unknown> }
      | undefined;
    expect(response?.errorCode).toBe('ERR_IMAGE_PARAMS_NOT_SUPPORTED');
    expect(response?.message).toContain('当前模型不支持所选参数');
    expect(response?.details).toMatchObject({ httpStatus: 400, protocolKey: 'openai-images@v1' });
    // 上游只被打了一次 —— 这条断言是那条被删掉的重试路径的墓碑。
    expect(fetchMock).toHaveBeenCalledTimes(1);

    global.fetch = originalFetch;
  });

  it('propagates a 5xx as-is instead of blaming the user params', async () => {
    const { service } = createService();
    const originalFetch = global.fetch;
    const fetchMock = jest.fn().mockResolvedValue(upstreamError(500, 'gateway exploded'));
    global.fetch = fetchMock as never;

    // 变异测试：若 callImageApi 把任何上游错误都映射成 ERR_IMAGE_PARAMS_NOT_SUPPORTED
    // （老 UPSTREAM_4XX_RE 的近亲），这条会红 —— 上游宕机会被误报成「参数不支持」，
    // 用户会去反复改尺寸。preset 的 errorMapping 把 500 分类成 'upstream'。
    let captured: unknown;
    try {
      await service.callImageApi(
        imageRequest({ settings: { size: '1024x1024@1K', quality: 'high' } }),
        1,
      );
    } catch (err) {
      captured = err;
    }

    expect(captured).toBeInstanceOf(Error);
    expect((captured as { status?: number }).status).not.toBe(400);
    expect(JSON.stringify((captured as { response?: unknown }).response ?? '')).not.toContain(
      'ERR_IMAGE_PARAMS_NOT_SUPPORTED',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);

    global.fetch = originalFetch;
  });

  it('rejects an image model whose protocolKey is missing — no silent fallback adapter', async () => {
    const { service } = createService();
    const originalFetch = global.fetch;
    global.fetch = jest.fn() as never;

    await expect(
      service.callImageApi(
        imageRequest({
          modelConfig: { ...IMAGE_MODEL_CONFIG, metadata: {} },
          settings: { size: '1024x1024@1K' },
        }),
        1,
      ),
    ).rejects.toThrow(/protocolKey/);
    expect(global.fetch).not.toHaveBeenCalled();

    global.fetch = originalFetch;
  });

  it('freezes configurable image points before provider call and settles from the frozen snapshot after persistence', async () => {
    const { service, prisma, pointsService } = createService();
    const order: string[] = [];
    pointsService.estimateCost.mockResolvedValueOnce({
      estimatedCost: 90,
      taskType: 'image_generation',
      pricingSnapshot: { ruleId: 'rule-2' },
    });
    pointsService.quoteHoldFromSnapshot.mockImplementation(async () => {
      order.push('quote');
      return 45;
    });
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
        },
      };
    });
    jest.spyOn(service, 'uploadGeneratedImages').mockImplementation(async () => {
      order.push('upload');
      return ['https://cdn.test/1.png'];
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

    // Hold-time estimate uses the new task/params/usage shape.
    // 用户参数原样透传 + 注入真实 referenceImages 张数；**不含 resolution**（由服务端
    // estimator 的 deriveParams 从 size 派生，不在这里手写）、**不含 quantity**
    // （张数由业务逻辑吃掉，不是计价参数）。
    expect(pointsService.estimateCost).toHaveBeenCalledTimes(1);
    expect(pointsService.estimateCost).toHaveBeenCalledWith({
      taskType: 'image_generation',
      modelConfigId: 'image-model-1',
      params: { quality: 'high', size: '1024x1024', referenceImages: 1 },
      membershipLevel: 2,
    });
    // 张数由业务逻辑计费：pricingSchema 只算单张，冻结额 = 单张估价(90) × 请求张数(2) = 180。
    expect(pointsService.createHold).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        amount: 180,
        taskType: 'image_generation',
        pricingSnapshot: { ruleId: 'rule-2' },
      }),
    );
    // Settlement re-prices from the frozen hold snapshot via quoteHoldFromSnapshot
    // (per-image = 45), never by calling estimateCost() again. Empty usage: image has
    // no usage-source params. 实扣 = 单张价(45) × 实际产图数(min(1, 2)=1) = 45；未产出
    // 的第 2 张在 confirm 时按差额(135)退回。
    expect(pointsService.quoteHoldFromSnapshot).toHaveBeenCalledWith('hold-1', {});
    expect(pointsService.confirmHoldWithinTx).toHaveBeenCalledWith(
      expect.any(Object),
      'hold-1',
      45,
    );
    expect(pointsService.refundHold).not.toHaveBeenCalled();
    expect(order).toEqual(['hold', 'provider', 'upload', 'persist', 'quote', 'confirm', 'image_record']);
    expect(result.prompt).toBe('A scene');
  });

  it('bills per-image × actual image count when the provider returns multiple images (count eaten by business logic)', async () => {
    const { service, prisma, pointsService } = createService();
    pointsService.estimateCost.mockResolvedValueOnce({
      estimatedCost: 40, // 单张估价
      taskType: 'image_generation',
      pricingSnapshot: { ruleId: 'rule-multi' },
    });
    // snapshot 每次返回单张价 40（quoteHoldFromSnapshot 内部会 cap 到冻结额，这里不触发）。
    pointsService.quoteHoldFromSnapshot.mockResolvedValue(40);
    pointsService.createHold.mockResolvedValue({ hold: { id: 'hold-1' }, balance: 1000 });
    prisma.image_generations.create.mockImplementation(async (args: any) => ({ id: 'gen-1', ...args.data }));
    jest.spyOn(service, 'callImageApi').mockResolvedValue({
      images: ['data:image/png;base64,A', 'data:image/png;base64,B', 'data:image/png;base64,C'],
      appliedSettings: { size: '1024x1024', quality: 'standard', count: 3, coerced: false, notes: [] },
    });
    jest.spyOn(service, 'uploadGeneratedImages').mockResolvedValue([
      'https://cdn.test/a.png',
      'https://cdn.test/b.png',
      'https://cdn.test/c.png',
    ]);

    await service.generateAndPersistImage(
      {
        userId: 'user-1',
        templateId: 'tpl-1',
        modelConfigId: 'image-model-1',
        settings: { quality: 'standard', size: '1024x1024' },
      },
      {
        mode: 'generate',
        prompt: 'A scene',
        modelConfig: {
          id: 'image-model-1',
          model: 'doubao-seedream-5-0-260128',
          provider: 'amux',
          baseUrl: 'https://api.example.com/v1',
          apiKey: 'key',
        },
        template: {},
        variables: {},
        settings: { quality: 'standard', size: '1024x1024' },
      },
      3,
    );

    // 冻结额 = 单张估价(40) × 请求张数(3) = 120。
    expect(pointsService.createHold).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ amount: 120, taskType: 'image_generation' }),
    );
    // 实扣 = 单张价(40) × 实际产图数(3) = 120（全部产出，无退款）。
    expect(pointsService.confirmHoldWithinTx).toHaveBeenCalledWith(expect.any(Object), 'hold-1', 120);
  });

  describe('count ceiling — clamped ONCE at the dispatch entry (model capability ∩ risk cap)', () => {
    async function dispatchWithCount(metadata: Record<string, unknown>, count: number) {
      const { service, prisma, pointsService } = createService();
      prisma.image_generations.create.mockImplementation(async (args: any) => ({ id: 'gen-1', ...args.data }));
      const callImageApi = jest.spyOn(service, 'callImageApi').mockResolvedValue({
        images: ['data:image/png;base64,A'],
        appliedSettings: { size: '1024x1024', count: 1, coerced: false, notes: [] },
      });
      jest.spyOn(service, 'uploadGeneratedImages').mockResolvedValue(['https://cdn.test/a.png']);

      const request = {
        mode: 'generate',
        prompt: 'A scene',
        modelConfig: { ...IMAGE_MODEL_CONFIG, metadata },
        template: {},
        variables: {},
        settings: { size: '1024x1024@1K' },
      } as never;

      await service.generateAndPersistImage(
        { userId: 'user-1', templateId: 'tpl-1', modelConfigId: 'image-model-1' },
        request,
        count,
      );
      return { callImageApi, pointsService };
    }

    it('clamps to metadata.limits.maxCount when the model can only produce one image', async () => {
      const { callImageApi, pointsService } = await dispatchWithCount(
        { protocolKey: 'openai-images@v1', limits: { maxCount: 1 } },
        4,
      );

      expect(callImageApi).toHaveBeenCalledWith(expect.anything(), 1);
      // 冻结额也跟着张数走：clamp 必须发生在 createHold 之前，否则会按 4 张冻结。
      expect(pointsService.createHold).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ amount: 90 }),
      );
    });

    it('clamps to the risk hard cap when the model claims a higher capability', async () => {
      const { callImageApi } = await dispatchWithCount(
        { protocolKey: 'openai-images@v1', limits: { maxCount: 99 } },
        99,
      );

      expect(callImageApi).toHaveBeenCalledWith(expect.anything(), 4);
    });

    it('falls back to the risk hard cap when the model declares no limit', async () => {
      const { callImageApi } = await dispatchWithCount({ protocolKey: 'openai-images@v1' }, 9);

      expect(callImageApi).toHaveBeenCalledWith(expect.anything(), 4);
    });
  });

  it('FIX-4: rejects an over-ceiling resolution before creating a hold', async () => {
    const { service, pointsService } = createService();

    await expect(
      service.generateAndPersistImage(
        {
          userId: 'user-1',
          templateId: 'tpl-1',
          modelConfigId: 'image-model-1',
          settings: { size: '8192x8192' },
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
          settings: { size: '8192x8192' },
        },
        1,
      ),
    ).rejects.toThrow();

    expect(pointsService.createHold).not.toHaveBeenCalled();
  });

  it('FIX-4: rejects when the membership entitlement gate denies the request', async () => {
    const { service, pointsService, membershipService } = createService();
    membershipService.assertImageEntitlement.mockImplementation(() => {
      throw new Error('IMAGE_MEMBERSHIP_LIMIT_EXCEEDED');
    });

    await expect(
      service.generateAndPersistImage(
        {
          userId: 'user-1',
          templateId: 'tpl-1',
          modelConfigId: 'image-model-1',
          settings: { size: '1024x1024' },
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
          settings: { size: '1024x1024' },
        },
        1,
      ),
    ).rejects.toThrow();

    expect(pointsService.createHold).not.toHaveBeenCalled();
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

  it('propagates when the image generation hold-time estimate throws (no fallback price)', async () => {
    const { service, pointsService } = createService();
    pointsService.estimateCost.mockRejectedValueOnce(new Error('模型未配置计价规则'));

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
    ).rejects.toThrow('模型未配置计价规则');

    expect(pointsService.createHold).not.toHaveBeenCalled();
  });

  it('propagates when settlement quoteHoldFromSnapshot throws for image generation (no live re-estimate fallback)', async () => {
    const { service, prisma, pointsService } = createService();
    jest.spyOn(service, 'callImageApi').mockResolvedValue({
      images: ['https://img.test/1.png'],
      appliedSettings: {
        size: '1024x1024',
        quality: 'medium',
        count: 1,
        coerced: false,
        notes: [],
      },
    });
    jest.spyOn(service, 'uploadGeneratedImages').mockResolvedValue(['https://img.test/1.png']);
    pointsService.quoteHoldFromSnapshot.mockRejectedValueOnce(new Error('积分冻结不存在'));

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
    ).rejects.toThrow('积分冻结不存在');

    // Settlement must not fall back to estimateCost() when the snapshot quote fails.
    expect(pointsService.estimateCost).toHaveBeenCalledTimes(1);
    expect(pointsService.refundHold).toHaveBeenCalledWith('hold-1', '图片生成失败');
    expect(prisma.image_generations.create).not.toHaveBeenCalled();
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

  it('charges platform points even for user-created image models', async () => {
    const { service, pointsService } = createService();
    jest.spyOn(service, 'callImageApi').mockResolvedValue({
      images: ['https://img.test/1.png'],
      appliedSettings: {
        size: '1024x1024',
        quality: 'medium',
        count: 1,
        coerced: false,
        notes: [],
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

    // 自有模型不再免费：即使 createdBy === userId 也照常估价 + 冻结积分。
    expect(pointsService.estimateCost).toHaveBeenCalled();
    expect(pointsService.createHold).toHaveBeenCalled();
  });
});
