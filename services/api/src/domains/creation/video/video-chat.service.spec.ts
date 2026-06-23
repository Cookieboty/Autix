import { VideoChatService } from './video-chat.service';
import type { WorkflowStepEvent } from '../llm/workflow/workflow.types';

function createService() {
  const modelConfigService = {
    getConfigForOrchestrator: jest.fn().mockResolvedValue({ id: 'model-1', model: 'gpt-4o-mini' }),
    findDefaultByTypeForUser: jest.fn().mockResolvedValue({ id: 'model-1', model: 'gpt-4o-mini' }),
  };
  const repository = {
    findConversationMessages: jest.fn().mockResolvedValue([]),
    findVideoDirectorProject: jest.fn().mockResolvedValue({
      title: '专业视频工作台',
      clips: [],
    }),
    findClipAtOrder: jest.fn().mockResolvedValue(null),
    createClip: jest.fn().mockResolvedValue({ id: 'clip-1' }),
    updateClip: jest.fn().mockResolvedValue({ id: 'clip-1' }),
    findNextClipOrder: jest.fn().mockResolvedValue(1),
    persistVideoDirectorTurn: jest.fn().mockResolvedValue(undefined),
  };
  const systemPromptService = {
    render: jest.fn().mockResolvedValue({
      content: 'You are a video director assistant.',
    }),
  };
  const pointsService = {
    estimateCost: jest.fn().mockResolvedValue({
      estimatedCost: 10,
      pricingSnapshot: { ruleId: 'rule-video-director' },
      refundPolicy: { systemFailed: 'full_refund' },
    }),
    createHold: jest.fn().mockResolvedValue({
      hold: { id: 'hold-1' },
      balance: 990,
    }),
    confirmHold: jest.fn().mockResolvedValue({ confirmed: true }),
    refundHold: jest.fn().mockResolvedValue({ refunded: true }),
  };
  const service = new VideoChatService(
    modelConfigService as never,
    repository as never,
    systemPromptService as never,
    pointsService as never,
  );
  return { service, modelConfigService, repository, systemPromptService, pointsService };
}

function mockAssistant(
  service: VideoChatService,
  content: string,
  options: { reject?: boolean; usage?: Record<string, number> } = {},
) {
  const invoke = options.reject
    ? jest.fn().mockRejectedValue(new Error(content))
    : jest.fn().mockResolvedValue({
        content,
        usage_metadata: options.usage,
      });
  (service as unknown as { prepareAssistantInvocation: jest.Mock }).prepareAssistantInvocation = jest
    .fn()
    .mockResolvedValue({
      config: { id: 'model-1', model: 'gpt-4o-mini', provider: 'openai' },
      model: { invoke },
      messages: [],
      inputTokens: 120,
    });
  return invoke;
}

describe('VideoChatService', () => {
  it('formats storyboard actions into clips and persists the director conversation', async () => {
    const { service, repository } = createService();
    mockAssistant(
      service,
      `<video_action>
{
  "action": "storyboard",
  "clips": [
    {
      "clipOrder": 1,
      "title": "开场",
      "prompt": "产品在晨光中缓慢转场",
      "params": {
        "duration": "6s",
        "ratio": "9:16",
        "resolution": "1080p",
        "generate_audio": true
      },
      "chainFromPrevious": false,
      "reasoning": "竖屏开场要先建立产品质感"
    }
  ]
}
</video_action>`,
    );

    const events: WorkflowStepEvent[] = [];
    for await (const event of service.chat({
      userId: 'user-1',
      conversationId: 'conv-1',
      projectId: 'project-1',
      message: '做一个 30 秒产品发布短片',
      modelConfigId: 'model-1',
    })) {
      events.push(event);
    }

    expect(repository.createClip).toHaveBeenCalledWith({
      projectId: 'project-1',
      order: 1,
      title: '开场',
      prompt: '产品在晨光中缓慢转场',
      params: {
        duration: 6,
        ratio: '9:16',
        resolution: '1080p',
        generateAudio: true,
      },
      chainFromPrev: false,
      status: 'pending',
    });
    expect(repository.persistVideoDirectorTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-1',
        userMessage: '做一个 30 秒产品发布短片',
        metadata: expect.objectContaining({
          action: 'storyboard',
          parsedActionCount: 1,
        }),
      }),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'llm_token',
      stepKey: 'video_chat',
    });
    expect(events[0].type === 'llm_token' ? events[0].content : '').toContain('已更新第 1 个片段');
  });

  it('keeps plain director replies in the same conversation', async () => {
    const { service, repository, pointsService } = createService();
    mockAssistant(service, '可以，我建议先明确目标受众和投放渠道。');

    const events: WorkflowStepEvent[] = [];
    for await (const event of service.chat({
      userId: 'user-1',
      conversationId: 'conv-1',
      projectId: 'project-1',
      message: '这个视频应该怎么做？',
    })) {
      events.push(event);
    }

    expect(repository.createClip).not.toHaveBeenCalled();
    expect(repository.persistVideoDirectorTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-1',
        assistantContent: '可以，我建议先明确目标受众和投放渠道。',
        metadata: expect.objectContaining({
          action: 'chat',
        }),
      }),
    );
    expect(events).toEqual([
      {
        type: 'llm_token',
        stepKey: 'video_chat',
        content: '可以，我建议先明确目标受众和投放渠道。',
      },
    ]);
    expect(pointsService.createHold).not.toHaveBeenCalled();
  });

  it('drops unsupported storyboard start and end timing params', async () => {
    const { service, repository } = createService();
    mockAssistant(
      service,
      `<video_action>
{
  "action": "storyboard",
  "clips": [
    {
      "clipOrder": 1,
      "title": "开场",
      "prompt": "产品从暗场中出现",
      "params": {
        "duration": 3,
        "startTime": 0,
        "endTime": 3,
        "start": 0,
        "end": 3,
        "ratio": "16:9"
      },
      "chainFromPrevious": false
    }
  ]
}
</video_action>`,
    );

    const events: WorkflowStepEvent[] = [];
    for await (const event of service.chat({
      userId: 'user-1',
      conversationId: 'conv-1',
      projectId: 'project-1',
      message: '做一个连续分镜',
    })) {
      events.push(event);
    }

    expect(repository.createClip).toHaveBeenCalledWith(
      expect.objectContaining({
        params: {
          duration: 3,
          ratio: '16:9',
        },
      }),
    );
    expect(events).toHaveLength(1);
  });

  it('charges video template optimization and confirms the hold with actual tokens', async () => {
    const { service, pointsService } = createService();
    pointsService.estimateCost
      .mockResolvedValueOnce({
        estimatedCost: 12,
        pricingSnapshot: { ruleId: 'rule-video-template' },
        refundPolicy: { systemFailed: 'full_refund' },
      })
      .mockResolvedValueOnce({
        estimatedCost: 7,
        pricingSnapshot: { ruleId: 'rule-video-template' },
        refundPolicy: { systemFailed: 'full_refund' },
      });
    mockAssistant(service, '优化后的视频提示词', {
      usage: {
        input_tokens: 130,
        output_tokens: 40,
        total_tokens: 170,
      },
    });

    const events: WorkflowStepEvent[] = [];
    for await (const event of service.chat({
      userId: 'user-1',
      conversationId: 'conv-1',
      projectId: 'project-1',
      message: '优化当前视频提示词',
      billingPurpose: 'video_template_optimize',
    })) {
      events.push(event);
    }

    expect(pointsService.estimateCost).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        taskType: 'video_template_optimize',
        modelProvider: 'openai',
        modelName: 'gpt-4o-mini',
        inputTokens: 120,
      }),
    );
    expect(pointsService.createHold).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        taskType: 'video_template_optimize',
        amount: 12,
        remark: '视频模板 AI 优化 · openai/gpt-4o-mini',
      }),
    );
    expect(pointsService.estimateCost).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        taskType: 'video_template_optimize',
        inputTokens: 130,
        outputTokens: 40,
        contextTokens: 170,
      }),
    );
    expect(pointsService.confirmHold).toHaveBeenCalledWith('hold-1', 7);
    expect(pointsService.refundHold).not.toHaveBeenCalled();
    expect(events).toHaveLength(1);
  });

  it('refunds video storyboard optimization hold when assistant invocation fails', async () => {
    const { service, pointsService, repository } = createService();
    mockAssistant(service, 'model unavailable', { reject: true });

    await expect((async () => {
      for await (const _event of service.chat({
        userId: 'user-1',
        conversationId: 'conv-1',
        projectId: 'project-1',
        message: '拆分镜脚本',
        billingPurpose: 'video_storyboard_optimize',
      })) {
        // consume generator
      }
    })()).rejects.toThrow('model unavailable');

    expect(pointsService.createHold).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        taskType: 'video_storyboard_optimize',
      }),
    );
    expect(pointsService.refundHold).toHaveBeenCalledWith('hold-1', '视频导演任务失败');
    expect(pointsService.confirmHold).not.toHaveBeenCalled();
    expect(repository.persistVideoDirectorTurn).not.toHaveBeenCalled();
  });
});
