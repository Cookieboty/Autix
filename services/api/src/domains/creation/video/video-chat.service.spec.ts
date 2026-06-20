import { VideoChatService } from './video-chat.service';
import type { WorkflowStepEvent } from '../llm/workflow/workflow.types';

function createService() {
  const modelConfigService = {
    getConfigForOrchestrator: jest.fn().mockResolvedValue({ id: 'model-1' }),
    findDefaultByType: jest.fn().mockResolvedValue({ id: 'model-1' }),
  };
  const prisma = {
    messages: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn((args) => Promise.resolve({ id: 'msg-1', ...args.data })),
    },
    video_projects: {
      findFirst: jest.fn().mockResolvedValue({
        title: '专业视频工作台',
        clips: [],
      }),
    },
    video_clips: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'clip-1' }),
      update: jest.fn().mockResolvedValue({ id: 'clip-1' }),
      aggregate: jest.fn().mockResolvedValue({ _max: { order: 0 } }),
    },
    $transaction: jest.fn((ops) => Promise.all(ops)),
  };
  const systemPromptService = {
    render: jest.fn().mockResolvedValue({
      content: 'You are a video director assistant.',
    }),
  };
  const service = new VideoChatService(
    modelConfigService as never,
    prisma as never,
    systemPromptService as never,
  );
  return { service, modelConfigService, prisma, systemPromptService };
}

function mockAssistant(
  service: VideoChatService,
  content: string,
) {
  (service as unknown as { invokeAssistant: jest.Mock }).invokeAssistant = jest
    .fn()
    .mockResolvedValue(content);
}

describe('VideoChatService', () => {
  it('formats storyboard actions into clips and persists the director conversation', async () => {
    const { service, prisma } = createService();
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

    expect(prisma.video_clips.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
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
      }),
    });
    expect(prisma.messages.create).toHaveBeenCalledTimes(2);
    expect(prisma.messages.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        conversationId: 'conv-1',
        role: 'USER',
        content: '做一个 30 秒产品发布短片',
      }),
    });
    expect(prisma.messages.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        conversationId: 'conv-1',
        role: 'ASSISTANT',
        metadata: expect.objectContaining({
          action: 'storyboard',
          parsedActionCount: 1,
          source: 'video_director',
        }),
      }),
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'llm_token',
      stepKey: 'video_chat',
    });
    expect(events[0].type === 'llm_token' ? events[0].content : '').toContain('已更新第 1 个片段');
  });

  it('keeps plain director replies in the same conversation', async () => {
    const { service, prisma } = createService();
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

    expect(prisma.video_clips.create).not.toHaveBeenCalled();
    expect(prisma.messages.create).toHaveBeenCalledTimes(2);
    expect(prisma.messages.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        conversationId: 'conv-1',
        role: 'ASSISTANT',
        content: '可以，我建议先明确目标受众和投放渠道。',
        metadata: expect.objectContaining({
          action: 'chat',
          source: 'video_director',
        }),
      }),
    });
    expect(events).toEqual([
      {
        type: 'llm_token',
        stepKey: 'video_chat',
        content: '可以，我建议先明确目标受众和投放渠道。',
      },
    ]);
  });

  it('drops unsupported storyboard start and end timing params', async () => {
    const { service, prisma } = createService();
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

    expect(prisma.video_clips.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        params: {
          duration: 3,
          ratio: '16:9',
        },
      }),
    });
    expect(events).toHaveLength(1);
  });
});
