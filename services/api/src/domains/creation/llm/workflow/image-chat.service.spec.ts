import { ImageChatService } from './image-chat.service';
import type { WorkflowStepEvent } from './workflow.types';

function createService() {
  const modelConfigService = {
    getConfigForOrchestrator: vi.fn().mockResolvedValue({ id: 'model-1' }),
    findDefaultByTypeForUser: vi.fn().mockResolvedValue({ id: 'chat-model' }),
  };
  const repository = {
    findConversationMessages: vi.fn().mockResolvedValue([]),
  };
  const systemPromptService = {
    render: vi.fn().mockResolvedValue({ content: 'image template chat prompt' }),
  };
  const imageGenerationFlowService = {
    resolveImageRequest: vi.fn().mockImplementation(async (input) => ({
      mode: input.sourceImages?.length ? 'edit' : 'generate',
      prompt: input.promptOverride,
      modelConfig: { model: 'gpt-image-2' },
      sourceImages: input.sourceImages,
      referenceImages: input.referenceImages,
    })),
    generateAndPersistImage: vi.fn().mockResolvedValue({
      images: [{ url: 'https://cdn/img-1.png', generationId: 'gen-1', index: 0, prompt: 'A futuristic product photo' }],
      prompt: 'A futuristic product photo',
      model: 'gpt-image-2',
    }),
  };
  const billing = {
    hold: vi.fn().mockResolvedValue({ holdId: 'hold-1', balance: 100 }),
    confirm: vi.fn().mockResolvedValue(undefined),
    refund: vi.fn().mockResolvedValue(undefined),
  };
  const service = new ImageChatService(
    modelConfigService as never,
    repository as never,
    systemPromptService as never,
    imageGenerationFlowService as never,
    billing as never,
  );
  return { service, modelConfigService, repository, systemPromptService, imageGenerationFlowService, billing };
}

describe('ImageChatService', () => {
  it('executes a generate_image tool action from the main image chat model', async () => {
    const { service, imageGenerationFlowService } = createService();
    service.invokeAssistant = vi.fn().mockResolvedValue({
      content: '',
      action: {
        type: 'generate_image',
        prompt: 'A futuristic product photo',
        reasoning: '用户在描述新图需求',
      },
    });

    const events: WorkflowStepEvent[] = [];
    for await (const event of service.chat({
      userId: 'user-1',
      conversationId: 'conv-1',
      message: '帮我做一张科技感产品图',
      imageModelConfigId: 'image-model',
      chatModelConfigId: 'chat-model',
      template: {
        id: 'tpl-1',
        title: '商品图',
        prompt: 'Create a product image',
        variables: [],
        modelHint: 'gpt-image-2',
      },
    })) {
      events.push(event);
    }

    expect(imageGenerationFlowService.resolveImageRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: 'tpl-1',
        modelConfigId: 'image-model',
        chatModelId: 'chat-model',
        promptOverride: 'A futuristic product photo',
        settings: expect.objectContaining({ skipPromptTuning: true }),
      }),
    );
    expect(events.map((event) => event.type)).toEqual(['image_generating', 'image_generated']);
    const generated = events[1] as Extract<WorkflowStepEvent, { type: 'image_generated' }>;
    expect(generated.images).toEqual([
      { url: 'https://cdn/img-1.png', generationId: 'gen-1', index: 0, prompt: 'A futuristic product photo' },
    ]);
  });

  it('treats legacy prompt_suggestion output as a generate_image action', async () => {
    const { service, imageGenerationFlowService } = createService();
    service.invokeAssistant = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        type: 'prompt_suggestion',
        prompt: 'A clean product poster',
      }),
      action: null,
    });

    const events: WorkflowStepEvent[] = [];
    for await (const event of service.chat({
      userId: 'user-1',
      conversationId: 'conv-1',
      message: '生成商品海报',
      imageModelConfigId: 'image-model',
      template: {
        id: 'tpl-1',
        title: '商品图',
        prompt: 'Create a product image',
        variables: [],
      },
    })) {
      events.push(event);
    }

    expect(imageGenerationFlowService.resolveImageRequest).toHaveBeenCalledWith(
      expect.objectContaining({ promptOverride: 'A clean product poster' }),
    );
    expect(events.map((event) => event.type)).toEqual(['image_generating', 'image_generated']);
  });

  it('executes an edit_image tool action with selected source images', async () => {
    const { service, imageGenerationFlowService } = createService();
    service.invokeAssistant = vi.fn().mockResolvedValue({
      content: '',
      action: {
        type: 'edit_image',
        instruction: 'Keep the product, change the background to blue',
        reasoning: '用户在修改已选图片',
      },
    });

    const sourceImages = [{ url: 'https://img.test/1.png', prompt: 'original' }];
    const events: WorkflowStepEvent[] = [];
    for await (const event of service.chat({
      userId: 'user-1',
      conversationId: 'conv-1',
      message: '把背景改成蓝色',
      imageModelConfigId: 'image-model',
      sourceImages,
      template: {
        id: 'tpl-1',
        title: '商品图',
        prompt: 'Create a product image',
        variables: [],
        modelHint: 'gpt-image-2',
      },
    })) {
      events.push(event);
    }

    expect(imageGenerationFlowService.resolveImageRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        promptOverride: 'Keep the product, change the background to blue',
        sourceImages,
      }),
    );
    expect(events.map((event) => event.type)).toEqual(['image_editing', 'image_generated']);
    const editing = events[0] as Extract<WorkflowStepEvent, { type: 'image_editing' }>;
    expect(editing.sourceImages).toEqual(sourceImages);
  });

  it('falls back to markdown when model output is not structured JSON', async () => {
    const { service } = createService();
    service.invokeAssistant = vi.fn().mockResolvedValue({
      content: '可以，我建议先明确产品主体。',
      action: null,
    });

    const events: WorkflowStepEvent[] = [];
    for await (const event of service.chat({
      userId: 'user-1',
      conversationId: 'conv-1',
      message: '你觉得怎么设计？',
      imageModelConfigId: 'image-model',
      template: {
        id: 'tpl-1',
        title: '商品图',
        prompt: 'Create a product image',
        variables: [],
        modelHint: 'gpt-image-2',
      },
    })) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'llm_token', stepKey: 'image_chat', content: '可以，我建议先明确产品主体。' },
    ]);
  });
});
