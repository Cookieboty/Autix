import { ImageChatService } from './image-chat.service';
import type { WorkflowStepEvent } from './workflow.types';

function createService() {
  const modelConfigService = {
    getConfigForOrchestrator: jest.fn().mockResolvedValue({ id: 'model-1' }),
    findDefaultByType: jest.fn().mockResolvedValue({ id: 'model-1' }),
  };
  const repository = {
    findConversationMessages: jest.fn().mockResolvedValue([]),
  };
  const systemPromptService = {
    render: jest.fn().mockResolvedValue({ content: 'image template chat prompt' }),
  };
  const service = new ImageChatService(
    modelConfigService as never,
    repository as never,
    systemPromptService as never,
  );
  return { service, modelConfigService, repository, systemPromptService };
}

describe('ImageChatService', () => {
  it('parses prompt suggestion JSON from model output', async () => {
    const { service } = createService();
    service.invokeAssistant = jest.fn().mockResolvedValue(
      JSON.stringify({
        type: 'prompt_suggestion',
        prompt: 'A futuristic product photo',
        model: 'gpt-image-2',
        reasoning: '用户在描述新图需求',
      }),
    );

    const events: WorkflowStepEvent[] = [];
    for await (const event of service.chat({
      userId: 'user-1',
      conversationId: 'conv-1',
      message: '帮我做一张科技感产品图',
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
      {
        type: 'prompt_suggestion',
        prompt: 'A futuristic product photo',
        model: 'gpt-image-2',
        reasoning: '用户在描述新图需求',
      },
    ]);
  });

  it('parses edit suggestion JSON when source images exist', async () => {
    const { service } = createService();
    service.invokeAssistant = jest.fn().mockResolvedValue(
      JSON.stringify({
        type: 'edit_suggestion',
        instruction: 'Keep the product, change the background to blue',
        model: 'gpt-image-2',
        reasoning: '用户在修改已选图片',
      }),
    );

    const sourceImages = [{ url: 'https://img.test/1.png', prompt: 'original' }];
    const events: WorkflowStepEvent[] = [];
    for await (const event of service.chat({
      userId: 'user-1',
      conversationId: 'conv-1',
      message: '把背景改成蓝色',
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

    expect(events).toEqual([
      {
        type: 'edit_suggestion',
        instruction: 'Keep the product, change the background to blue',
        sourceImages,
        model: 'gpt-image-2',
        reasoning: '用户在修改已选图片',
      },
    ]);
  });

  it('falls back to markdown when model output is not structured JSON', async () => {
    const { service } = createService();
    service.invokeAssistant = jest.fn().mockResolvedValue('可以，我建议先明确产品主体。');

    const events: WorkflowStepEvent[] = [];
    for await (const event of service.chat({
      userId: 'user-1',
      conversationId: 'conv-1',
      message: '你觉得怎么设计？',
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
