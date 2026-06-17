import {
  ModelType,
  VideoClipStatus,
  VideoGenStatus,
  VideoProjectStatus,
} from '../prisma/generated';
import { VideoGenerationFlowService } from './video-generation-flow.service';

function makeService(options: { clip?: Record<string, any> } = {}) {
  const baseClip = {
    id: 'clip-1',
    projectId: 'project-1',
    userId: 'user-1',
    order: 1,
    prompt: 'A cinematic product shot',
    params: {
      modelConfigId: 'model-config-1',
      resolution: '720p',
      duration: 5,
      ratio: '16:9',
    },
    status: VideoClipStatus.pending,
    chainFromPrev: false,
    materials: [
      {
        id: 'mat-1',
        clipId: 'clip-1',
        role: 'reference_image',
        sourceType: 'upload',
        sourceId: null,
        url: 'https://img.test/ref.png',
        name: 'Reference',
        metadata: null,
        createdAt: new Date(),
      },
    ],
    project: {
      id: 'project-1',
      userId: 'user-1',
    },
  };
  const clip = {
    ...baseClip,
    ...(options.clip ?? {}),
    params: {
      ...baseClip.params,
      ...(options.clip?.params ?? {}),
    },
    materials: options.clip?.materials ?? baseClip.materials,
  };

  const prisma = {
    $transaction: jest.fn(async (callback: any) => callback(prisma)),
    video_clips: {
      findUnique: jest.fn(async (args: any) => {
        if (args.where?.id === 'clip-1') return clip;
        if (args.where?.projectId_order) return null;
        return null;
      }),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(async (args: any) => {
        if (args.where?.order?.gt != null) return [];
        return [{ status: VideoClipStatus.failed }];
      }),
    },
    video_projects: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    video_clip_generations: {
      create: jest.fn(async (args: any) => ({
        id: args.data.id,
        clipId: 'clip-1',
        projectId: 'project-1',
        userId: 'user-1',
        status: VideoGenStatus.pending,
      })),
      update: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  const pointsService = {
    estimateCost: jest.fn(async () => ({
      estimatedCost: 1600,
      taskType: 'seedance_720p',
      pricingSnapshot: { ruleId: 'rule-video' },
      refundPolicy: { systemFailed: 'full_refund' },
    })),
    createHold: jest.fn(async () => ({
      hold: { id: 'hold-1' },
      balance: 4900,
    })),
    findPendingHoldByTask: jest.fn(async () => ({ id: 'hold-1', userId: 'user-1' })),
    confirmHold: jest.fn(),
    refundHold: jest.fn(async () => ({
      refunded: true,
      amount: 1600,
      balance: 6500,
    })),
    refundByGenerationId: jest.fn(),
  };
  const r2Service = {
    uploadBuffer: jest.fn(async () => ({
      publicUrl: 'https://cdn.test/video.mp4',
    })),
  };
  const modelConfigService = {
    findDefaultByType: jest.fn(async () => ({
      id: 'model-config-1',
      name: 'Seedance',
      model: 'seedance-pro',
    })),
    getConfigForOrchestrator: jest.fn(async () => ({
      id: 'model-config-1',
      model: 'seedance-pro',
      apiKey: 'video-key',
    })),
  };
  const seedanceApi = {
    buildContent: jest.fn(() => [
      { type: 'text', text: 'A cinematic product shot' },
      { type: 'image_url', image_url: { url: 'https://img.test/ref.png' } },
    ]),
    buildTaskRequest: jest.fn((opts: any) => ({
      model: opts.model,
      content: opts.content,
      resolution: opts.resolution,
      ratio: opts.ratio,
      duration: opts.duration,
    })),
    createTask: jest.fn(async () => ({ id: 'seedance-task-1' })),
    queryTask: jest.fn(),
  };
  const config = { get: jest.fn(() => undefined) };
  const membershipService = {
    resolveVideoEntitlements: jest.fn(async () => ({
      enabled: true,
      maxResolution: '1080p' as const,
      maxDurationSeconds: 30,
      concurrency: 4,
      levelName: 'Pro',
      level: 3,
      source: 'membership' as const,
    })),
    assertVideoEntitlement: jest.fn(() => { }),
  };
  const inviteService = {
    settleInvitationOnFirstGeneration: jest.fn(async () => null),
  };
  const riskService = {
    assertVideoRequest: jest.fn(async () => ({ active: 0, limit: 4 })),
    assertHardLimits: jest.fn(() => { }),
    assertConcurrency: jest.fn(async () => ({ active: 0, limit: 4 })),
  };

  const service = new VideoGenerationFlowService(
    prisma as never,
    pointsService as never,
    r2Service as never,
    modelConfigService as never,
    seedanceApi as never,
    config as never,
    membershipService as never,
    inviteService as never,
    riskService as never,
  );

  return {
    service,
    prisma,
    pointsService,
    r2Service,
    modelConfigService,
    seedanceApi,
    membershipService,
    inviteService,
    riskService,
  };
}

describe('VideoGenerationFlowService billing', () => {
  it('freezes configurable Seedance points before creating the generation and provider task', async () => {
    const { service, prisma, pointsService, seedanceApi } = makeService();
    const order: string[] = [];
    pointsService.createHold.mockImplementation(async () => {
      order.push('hold');
      return { hold: { id: 'hold-1' }, balance: 4900 };
    });
    prisma.video_clip_generations.create.mockImplementation(async (args: any) => {
      order.push('generation');
      return {
        id: args.data.id,
        clipId: 'clip-1',
        projectId: 'project-1',
        userId: 'user-1',
        status: VideoGenStatus.pending,
      };
    });
    seedanceApi.createTask.mockImplementation(async () => {
      order.push('provider');
      return { id: 'seedance-task-1' };
    });

    const result = await service.generateClip({
      clipId: 'clip-1',
      projectId: 'project-1',
      userId: 'user-1',
    });

    expect(pointsService.estimateCost).toHaveBeenCalledWith(
      expect.objectContaining({
        taskType: 'seedance_720p',
        resolution: '720p',
        seconds: 5,
        referenceImages: 1,
      }),
    );
    expect(pointsService.createHold).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        taskType: 'seedance_720p',
        taskId: result.generationId,
        amount: 1600,
      }),
    );
    expect(order).toEqual(['hold', 'generation', 'provider']);
    expect(result).toEqual({
      generationId: expect.any(String),
      taskId: 'seedance-task-1',
    });
  });

  it('combines storyboard prompt and clip prompt for storyboard generation', async () => {
    const { service, prisma, seedanceApi } = makeService({
      clip: {
        prompt: '产品从左侧滑入，镜头缓慢推进',
        params: {
          generationMode: 'storyboard',
          storyboardPrompt: '高端科技广告，冷色光线，节奏干净',
        },
      },
    });

    await service.generateClip({
      clipId: 'clip-1',
      projectId: 'project-1',
      userId: 'user-1',
    });

    const resolvedPrompt =
      '整片提示词：高端科技广告，冷色光线，节奏干净\n\n当前分镜提示词：产品从左侧滑入，镜头缓慢推进';
    expect(seedanceApi.buildContent).toHaveBeenCalledWith(
      expect.any(Array),
      resolvedPrompt,
    );
    expect(prisma.video_clip_generations.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          resolvedPrompt,
        }),
      }),
    );
  });

  it('refunds the hold when local generation creation fails after freezing points', async () => {
    const { service, prisma, pointsService, seedanceApi } = makeService();
    prisma.video_clip_generations.create.mockRejectedValue(
      new Error('generation create failed'),
    );

    await expect(
      service.generateClip({
        clipId: 'clip-1',
        projectId: 'project-1',
        userId: 'user-1',
      }),
    ).rejects.toThrow('generation create failed');

    expect(pointsService.createHold).toHaveBeenCalled();
    const holdInput = (
      pointsService.createHold.mock.calls as unknown as Array<
        [unknown, { taskId: string }]
      >
    )[0]?.[1];
    expect(holdInput).toBeDefined();
    expect(pointsService.findPendingHoldByTask).toHaveBeenCalledWith({
      taskId: holdInput!.taskId,
    });
    expect(pointsService.refundHold).toHaveBeenCalledWith(
      'hold-1',
      'video generation creation failed',
    );
    expect(seedanceApi.createTask).not.toHaveBeenCalled();
  });

  it('refunds the frozen points when provider task creation fails', async () => {
    const { service, pointsService, seedanceApi } = makeService();
    seedanceApi.createTask.mockRejectedValue(new Error('Seedance unavailable'));

    await expect(
      service.generateClip({
        clipId: 'clip-1',
        projectId: 'project-1',
        userId: 'user-1',
      }),
    ).rejects.toThrow('Seedance unavailable');

    expect(pointsService.createHold).toHaveBeenCalled();
    const holdInput = (
      pointsService.createHold.mock.calls as unknown as Array<
        [unknown, { taskId: string }]
      >
    )[0]?.[1];
    expect(holdInput).toBeDefined();
    expect(pointsService.findPendingHoldByTask).toHaveBeenCalledWith({
      taskId: holdInput!.taskId,
    });
    expect(pointsService.refundHold).toHaveBeenCalledWith(
      'hold-1',
      'createTask 同步失败',
    );
  });

  it('confirms the frozen points after successful video persistence', async () => {
    const { service, pointsService, r2Service } = makeService();
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    }) as never;

    await service.applyTaskStatus(
      {
        id: 'gen-1',
        clipId: 'clip-1',
        projectId: 'project-1',
        userId: 'user-1',
        status: VideoGenStatus.queued,
      } as never,
      {
        status: 'succeeded',
        video_url: 'https://provider.test/video.mp4',
        duration: 5,
      },
    );

    expect(r2Service.uploadBuffer).toHaveBeenCalled();
    expect(pointsService.findPendingHoldByTask).toHaveBeenCalledWith({
      taskId: 'gen-1',
    });
    expect(pointsService.confirmHold).toHaveBeenCalledWith('hold-1');
    expect(pointsService.refundHold).not.toHaveBeenCalled();

    global.fetch = originalFetch;
  });

  it('refunds the frozen points when Seedance reports failure', async () => {
    const { service, pointsService } = makeService();

    await service.applyTaskStatus(
      {
        id: 'gen-1',
        clipId: 'clip-1',
        projectId: 'project-1',
        userId: 'user-1',
        status: VideoGenStatus.queued,
      } as never,
      {
        status: 'failed',
        error: { message: 'provider rejected' },
      },
    );

    expect(pointsService.findPendingHoldByTask).toHaveBeenCalledWith({
      taskId: 'gen-1',
    });
    expect(pointsService.refundHold).toHaveBeenCalledWith(
      'hold-1',
      '视频生成失败: provider rejected',
    );
    expect(pointsService.confirmHold).not.toHaveBeenCalled();
  });

  it('reconciles a pending hold for an already completed generation', async () => {
    const { service, pointsService } = makeService();

    await service.applyTaskStatus(
      {
        id: 'gen-1',
        clipId: 'clip-1',
        projectId: 'project-1',
        userId: 'user-1',
        status: VideoGenStatus.completed,
      } as never,
      { status: 'succeeded' },
    );

    expect(pointsService.confirmHold).toHaveBeenCalledWith('hold-1');
    expect(pointsService.refundHold).not.toHaveBeenCalled();
  });

  it('reconciles a pending hold for an already failed generation', async () => {
    const { service, pointsService } = makeService();

    await service.applyTaskStatus(
      {
        id: 'gen-1',
        clipId: 'clip-1',
        projectId: 'project-1',
        userId: 'user-1',
        status: VideoGenStatus.failed,
      } as never,
      { status: 'failed' },
    );

    expect(pointsService.refundHold).toHaveBeenCalledWith(
      'hold-1',
      '终态对账: failed',
    );
    expect(pointsService.confirmHold).not.toHaveBeenCalled();
  });

  it('does not query the default video model when clip already has a model config', async () => {
    const { service, modelConfigService } = makeService();

    await service.generateClip({
      clipId: 'clip-1',
      projectId: 'project-1',
      userId: 'user-1',
    });

    expect(modelConfigService.findDefaultByType).not.toHaveBeenCalledWith(
      ModelType.video,
    );
  });

  it('rejects generation when membership entitlement gate blocks the request', async () => {
    const { service, membershipService, pointsService, seedanceApi } =
      makeService();
    membershipService.assertVideoEntitlement.mockImplementation(() => {
      throw new Error('当前会员等级不支持该视频生成参数');
    });

    await expect(
      service.generateClip({
        clipId: 'clip-1',
        projectId: 'project-1',
        userId: 'user-1',
      }),
    ).rejects.toThrow('当前会员等级不支持该视频生成参数');

    expect(membershipService.resolveVideoEntitlements).toHaveBeenCalledWith(
      'user-1',
    );
    expect(pointsService.createHold).not.toHaveBeenCalled();
    expect(seedanceApi.createTask).not.toHaveBeenCalled();
  });

  it('settles the invitation reward after successful video confirmation', async () => {
    const { service, inviteService } = makeService();
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    }) as never;

    await service.applyTaskStatus(
      {
        id: 'gen-1',
        clipId: 'clip-1',
        projectId: 'project-1',
        userId: 'user-1',
        status: VideoGenStatus.queued,
      } as never,
      {
        status: 'succeeded',
        video_url: 'https://provider.test/video.mp4',
        duration: 5,
      },
    );

    expect(inviteService.settleInvitationOnFirstGeneration).toHaveBeenCalledWith(
      'user-1',
    );

    global.fetch = originalFetch;
  });

  it('does not settle the invitation reward when the video task fails', async () => {
    const { service, inviteService } = makeService();

    await service.applyTaskStatus(
      {
        id: 'gen-1',
        clipId: 'clip-1',
        projectId: 'project-1',
        userId: 'user-1',
        status: VideoGenStatus.queued,
      } as never,
      {
        status: 'failed',
        error: { message: 'provider rejected' },
      },
    );

    expect(
      inviteService.settleInvitationOnFirstGeneration,
    ).not.toHaveBeenCalled();
  });
});
