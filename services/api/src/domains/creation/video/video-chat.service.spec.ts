import type { Mock } from 'vitest';
import { VideoChatService } from './video-chat.service';
import type { WorkflowStepEvent } from '../llm/workflow/workflow.types';

function createService() {
  const modelConfigService = {
    getConfigForOrchestrator: vi.fn().mockResolvedValue({ id: 'model-1', model: 'gpt-4o-mini' }),
    findDefaultByTypeForUser: vi.fn().mockResolvedValue({ id: 'model-1', model: 'gpt-4o-mini' }),
  };
  const repository = {
    findConversationMessages: vi.fn().mockResolvedValue([]),
    findVideoDirectorProject: vi.fn().mockResolvedValue({
      title: '专业视频工作台',
      clips: [],
    }),
    findClipAtOrder: vi.fn().mockResolvedValue(null),
    createClip: vi.fn().mockResolvedValue({ id: 'clip-1' }),
    updateClip: vi.fn().mockResolvedValue({ id: 'clip-1' }),
    findNextClipOrder: vi.fn().mockResolvedValue(1),
    persistVideoDirectorTurn: vi.fn().mockResolvedValue(undefined),
  };
  const systemPromptService = {
    render: vi.fn().mockResolvedValue({
      content: 'You are a video director assistant.',
    }),
  };
  const pointsService = {
    estimateCost: vi.fn().mockResolvedValue({
      estimatedCost: 10,
      taskType: 'video_template_optimize',
      modelConfigId: 'model-1',
      breakdown: [],
      pricingSnapshot: { ruleId: 'rule-video-director' },
    }),
    createHold: vi.fn().mockResolvedValue({
      hold: { id: 'hold-1' },
      balance: 990,
    }),
    quoteHoldFromSnapshot: vi.fn().mockResolvedValue(8),
    confirmHold: vi.fn().mockResolvedValue({ confirmed: true }),
    refundHold: vi.fn().mockResolvedValue({ refunded: true }),
  };
  const membershipService = {
    resolveActiveMembershipLevel: vi.fn().mockResolvedValue(2),
  };
  const service = new VideoChatService(
    modelConfigService as never,
    repository as never,
    systemPromptService as never,
    pointsService as never,
    membershipService as never,
  );
  return { service, modelConfigService, repository, systemPromptService, pointsService, membershipService };
}

function mockAssistant(
  service: VideoChatService,
  content: string,
  options: { reject?: boolean; usage?: Record<string, number> } = {},
) {
  const invoke = options.reject
    ? vi.fn().mockRejectedValue(new Error(content))
    : vi.fn().mockResolvedValue({
        content,
        usage_metadata: options.usage,
      });
  (service as unknown as { prepareAssistantInvocation: Mock }).prepareAssistantInvocation = vi
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

  it('charges video template optimization with the new estimate shape and settles from the snapshot', async () => {
    const { service, pointsService } = createService();
    pointsService.estimateCost.mockResolvedValueOnce({
      estimatedCost: 12,
      taskType: 'video_template_optimize',
      modelConfigId: 'model-1',
      breakdown: [],
      pricingSnapshot: { ruleId: 'rule-video-template' },
    });
    pointsService.quoteHoldFromSnapshot.mockResolvedValueOnce(7);
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

    // Estimate uses the new engine's shape: taskType/modelConfigId/params/usage,
    // tokens live under usage (not params).
    expect(pointsService.estimateCost).toHaveBeenCalledTimes(1);
    expect(pointsService.estimateCost).toHaveBeenCalledWith({
      taskType: 'video_template_optimize',
      modelConfigId: 'model-1',
      params: {},
      usage: { inputTokens: 120, outputTokens: 128 },
      membershipLevel: 2,
    });

    const createHoldArgs = pointsService.createHold.mock.calls[0][1];
    expect(createHoldArgs).toMatchObject({
      taskType: 'video_template_optimize',
      amount: 12,
      pricingSnapshot: { ruleId: 'rule-video-template' },
      remark: '视频模板 AI 优化 · openai/gpt-4o-mini',
    });
    expect(createHoldArgs).not.toHaveProperty('refundPolicySnapshot');

    // Settlement prices off the frozen snapshot via quoteHoldFromSnapshot, and
    // never calls estimateCost a second time (no live re-estimate at settlement).
    expect(pointsService.quoteHoldFromSnapshot).toHaveBeenCalledWith(
      'hold-1',
      expect.objectContaining({ inputTokens: 130, outputTokens: 40, contextTokens: 170 }),
    );
    expect(pointsService.estimateCost).toHaveBeenCalledTimes(1);
    expect(pointsService.confirmHold).toHaveBeenCalledWith('hold-1', 7);
    expect(pointsService.refundHold).not.toHaveBeenCalled();
    expect(events).toHaveLength(1);
  });

  it('propagates when the estimate throws instead of falling back to a metered charge', async () => {
    const { service, pointsService } = createService();
    pointsService.estimateCost.mockRejectedValueOnce(new Error('任务未配置: video_template_optimize'));
    mockAssistant(service, '优化后的视频提示词');

    await expect(
      (async () => {
        for await (const _event of service.chat({
          userId: 'user-1',
          conversationId: 'conv-1',
          projectId: 'project-1',
          message: '优化当前视频提示词',
          billingPurpose: 'video_template_optimize',
        })) {
          // consume generator
        }
      })(),
    ).rejects.toThrow('任务未配置: video_template_optimize');

    expect(pointsService.createHold).not.toHaveBeenCalled();
    expect(pointsService.refundHold).not.toHaveBeenCalled();
    expect(pointsService.confirmHold).not.toHaveBeenCalled();
  });

  it('propagates when settlement fails instead of confirming at a substituted price', async () => {
    const { service, pointsService } = createService();
    pointsService.quoteHoldFromSnapshot.mockRejectedValueOnce(new Error('积分冻结不存在'));
    mockAssistant(service, '优化后的视频提示词', {
      usage: { input_tokens: 130, output_tokens: 40, total_tokens: 170 },
    });

    await expect(
      (async () => {
        for await (const _event of service.chat({
          userId: 'user-1',
          conversationId: 'conv-1',
          projectId: 'project-1',
          message: '优化当前视频提示词',
          billingPurpose: 'video_template_optimize',
        })) {
          // consume generator
        }
      })(),
    ).rejects.toThrow('积分冻结不存在');

    expect(pointsService.confirmHold).not.toHaveBeenCalled();
    expect(pointsService.refundHold).toHaveBeenCalledWith('hold-1', '视频导演任务失败');
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
