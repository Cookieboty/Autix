import { ChatFallbackService } from './chat-fallback.service';
import type { WorkflowStepEvent } from './workflow.types';

const invoke = jest.fn();

jest.mock('../model.factory', () => ({
  createChatModelFromDbConfig: jest.fn(() => ({ invoke })),
}));

jest.mock('../billing/llm-call-tracker', () => ({
  createTrackedModel: jest.fn((model) => model),
}));

function createService() {
  const modelConfigService = {
    getConfigForOrchestrator: jest.fn().mockResolvedValue({
      id: 'chat-model',
      model: 'gpt-4o',
      name: 'GPT',
      provider: 'openai',
      type: 'general',
      capabilities: ['text'],
      pointCostWeight: 1,
    }),
    findDefaultByTypeForUser: jest.fn().mockResolvedValue({ id: 'chat-model' }),
  };
  const billing = {};
  const systemPromptService = {
    render: jest.fn().mockResolvedValue({ content: 'system prompt with image tool' }),
  };
  const imageGenerationFlowService = {
    resolveImageRequest: jest.fn().mockImplementation(async (input) => ({
      mode: input.sourceImages?.length ? 'edit' : 'generate',
      prompt: input.promptOverride,
      modelConfig: { model: 'gpt-image-2' },
      sourceImages: input.sourceImages,
      referenceImages: input.referenceImages,
    })),
    generateAndPersistImage: jest.fn().mockResolvedValue({
      images: [{ url: 'https://cdn/img-1.png', generationId: 'gen-1', index: 0, prompt: 'a cat' }],
      prompt: 'a cat',
      model: 'gpt-image-2',
    }),
  };
  const service = new ChatFallbackService(
    modelConfigService as never,
    billing as never,
    systemPromptService as never,
    imageGenerationFlowService as never,
  );
  return { service, modelConfigService, systemPromptService, imageGenerationFlowService };
}

async function collect(gen: AsyncGenerator<WorkflowStepEvent>) {
  const events: WorkflowStepEvent[] = [];
  for await (const event of gen) events.push(event);
  return events;
}

describe('ChatFallbackService image tool actions', () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it('executes a generate_image action from the normal chat model', async () => {
    const { service, systemPromptService, imageGenerationFlowService } = createService();
    invoke.mockResolvedValue({
      content: JSON.stringify({ type: 'generate_image', prompt: 'a cat' }),
    });

    const events = await collect(service.chat(
      'user-1',
      '画一只猫',
      'chat-model',
      undefined,
      {
        imageTool: {
          conversationId: 'conv-1',
          imageModelConfigId: 'image-model',
          template: {
            id: 'tpl-1',
            title: '对话图片工具',
            prompt: '{{prompt}}',
            variables: [],
          },
          settings: { size: '1024x1024', quality: 'medium' },
        },
      },
    ));

    expect(systemPromptService.render).toHaveBeenCalledWith(
      'assistant.generalWithImageTool',
      expect.objectContaining({ templateTitle: '对话图片工具' }),
    );
    expect(imageGenerationFlowService.resolveImageRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-1',
        templateId: 'tpl-1',
        modelConfigId: 'image-model',
        promptOverride: 'a cat',
        settings: expect.objectContaining({ skipPromptTuning: true }),
      }),
    );
    expect(events.map((event) => event.type)).toEqual(['image_generating', 'image_generated']);
  });

  it('falls back to markdown when the normal chat model does not call the image tool', async () => {
    const { service, imageGenerationFlowService } = createService();
    invoke.mockResolvedValue({ content: '可以，我来解释一下。' });

    const events = await collect(service.chat(
      'user-1',
      '解释一下图片构图',
      'chat-model',
      undefined,
      {
        imageTool: {
          conversationId: 'conv-1',
          imageModelConfigId: 'image-model',
          template: {
            id: 'tpl-1',
            title: '对话图片工具',
            prompt: '{{prompt}}',
            variables: [],
          },
        },
      },
    ));

    expect(events).toEqual([
      { type: 'llm_token', stepKey: 'chat', content: '可以，我来解释一下。' },
    ]);
    expect(imageGenerationFlowService.generateAndPersistImage).not.toHaveBeenCalled();
  });

  it('uses uploaded reference images as edit sources when edit_image is requested', async () => {
    const { service, imageGenerationFlowService } = createService();
    const referenceImages = [{ url: 'https://img.test/upload.png', prompt: 'uploaded' }];
    invoke.mockResolvedValue({
      content: JSON.stringify({ type: 'edit_image', instruction: '换成蓝色背景' }),
    });

    const events = await collect(service.chat(
      'user-1',
      '把这张图背景改成蓝色',
      'chat-model',
      ['https://img.test/upload.png'],
      {
        imageTool: {
          conversationId: 'conv-1',
          imageModelConfigId: 'image-model',
          template: {
            id: 'tpl-1',
            title: '对话图片工具',
            prompt: '{{prompt}}',
            variables: [],
          },
          referenceImages,
        },
      },
    ));

    expect(imageGenerationFlowService.resolveImageRequest).toHaveBeenCalledWith(
      expect.objectContaining({ sourceImages: referenceImages }),
    );
    expect(events.map((event) => event.type)).toEqual(['image_editing', 'image_generated']);
  });
});
