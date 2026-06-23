import {
  ModelType,
  PointHoldStatus,
  VideoClipStatus,
  VideoGenStatus,
  VideoProjectStatus,
} from '../../platform/prisma/generated';
import { VideoGenerationFlowService } from './video-generation-flow.service';
import { VideoGenerationHoldReconciliationService } from './video-generation-hold-reconciliation.service';
import { VideoGenerationRepository } from './video-generation.repository';
import { VideoGenerationTerminalConvergenceService } from './video-generation-terminal-convergence.service';

function makeService(options: { clip?: Record<string, any>; projectClips?: Array<Record<string, any>> } = {}) {
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
        if (args.where?.projectId === 'project-1' && args.orderBy?.order === 'asc') {
          return options.projectClips ?? [clip];
        }
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
    point_holds: {
      findFirst: jest.fn(async () => ({
        id: 'hold-1',
        userId: 'user-1',
        status: PointHoldStatus.PENDING,
      })),
    },
  };
  const pointsService = {
    estimateCost: jest.fn(async () => ({
      estimatedCost: 1600,
      taskType: 'video_generation',
      pricingSnapshot: { ruleId: 'rule-video' },
      refundPolicy: { systemFailed: 'full_refund' },
    })),
    createHold: jest.fn(async () => ({
      hold: { id: 'hold-1' },
      balance: 4900,
    })),
    findPendingHoldByTask: jest.fn(async () => ({ id: 'hold-1', userId: 'user-1' })),
    confirmHold: jest.fn(async () => ({
      confirmed: true,
      hold: { id: 'hold-1', userId: 'user-1', status: PointHoldStatus.CONFIRMED },
      balance: 3300,
    })),
    confirmHoldWithinTx: jest.fn(async () => ({
      confirmed: true,
      hold: { id: 'hold-1', userId: 'user-1', status: PointHoldStatus.CONFIRMED },
      balance: 3300,
    })),
    refundHold: jest.fn(async () => ({
      refunded: true,
      amount: 1600,
      balance: 6500,
    })),
    refundHoldWithinTx: jest.fn(async () => ({
      refunded: true,
      amount: 1600,
      balance: 6500,
    })),
  };
  const r2Service = {
    uploadBuffer: jest.fn(async (_buffer: Buffer, _opts: any) => ({
      publicUrl: 'https://cdn.test/video.mp4',
    })),
  };
  const modelConfigService = {
    findDefaultByType: jest.fn(async (_type: ModelType) => ({
      id: 'model-config-1',
      name: 'Seedance',
      model: 'seedance-pro',
    })),
    getConfigForOrchestrator: jest.fn(async (id: string) => ({
      id,
      model: 'seedance-pro',
      baseUrl: null,
      apiKey: 'video-key',
    })),
  };
  const seedanceApi = {
    buildContent: jest.fn((materials: any[], prompt: string) => [
      { type: 'text', text: prompt },
      ...materials.map((material) => ({
        type: 'image_url',
        image_url: { url: material.url },
      })),
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
  const modelResolver = {
    probeDefaultVideoModel: jest.fn(),
    resolveForGeneration: jest.fn(async () => {
      let modelConfigId = (clip.params as { modelConfigId?: string }).modelConfigId;
      if (!modelConfigId) {
        const def = await modelConfigService.findDefaultByType(ModelType.video);
        if (!def) {
          throw new Error('未配置默认视频模型，请先在管理后台配置（type=video, isDefault=true）');
        }
        modelConfigId = def.id;
        await prisma.video_clips.update({
          where: { id: clip.id },
          data: {
            params: {
              ...(clip.params as Record<string, unknown>),
              modelConfigId,
            },
          },
        });
      }
      const modelConfig =
        await modelConfigService.getConfigForOrchestrator(modelConfigId);
      if (!modelConfig.apiKey) throw new Error('视频模型缺少 API Key 配置');
      return {
        modelConfigId,
        modelConfig,
        apiKey: modelConfig.apiKey,
        baseUrl: modelConfig.baseUrl,
      };
    }),
    getApiKeyForClipParams: jest.fn(async (params: any) => {
      const modelConfigId = params?.modelConfigId;
      if (!modelConfigId) return null;
      const modelConfig =
        await modelConfigService.getConfigForOrchestrator(modelConfigId);
      return modelConfig.apiKey ?? null;
    }),
    getApiKeyForClipParamsOrThrow: jest.fn(async (params: any) => {
      const modelConfigId = params?.modelConfigId;
      if (!modelConfigId) throw new Error('Clip 未配置模型，无法刷新');
      const modelConfig =
        await modelConfigService.getConfigForOrchestrator(modelConfigId);
      if (!modelConfig.apiKey) throw new Error('视频模型缺少 API Key 配置');
      return modelConfig.apiKey;
    }),
    resolveApiContextForClipParams: jest.fn(async (params: any) => {
      const modelConfigId = params?.modelConfigId;
      if (!modelConfigId) return null;
      const modelConfig =
        await modelConfigService.getConfigForOrchestrator(modelConfigId);
      if (!modelConfig.apiKey) return null;
      return {
        apiKey: modelConfig.apiKey,
        baseUrl: modelConfig.baseUrl,
        modelConfigId,
        model: modelConfig.model,
      };
    }),
    resolveApiContextForClipParamsOrThrow: jest.fn(async (params: any) => {
      const modelConfigId = params?.modelConfigId;
      if (!modelConfigId) throw new Error('Clip 未配置模型，无法刷新');
      const modelConfig =
        await modelConfigService.getConfigForOrchestrator(modelConfigId);
      if (!modelConfig.apiKey) throw new Error('视频模型缺少 API Key 配置');
      return {
        apiKey: modelConfig.apiKey,
        baseUrl: modelConfig.baseUrl,
        modelConfigId,
        model: modelConfig.model,
      };
    }),
  };
  const callbackUrlBuilder = { build: jest.fn(() => undefined) };
  const videoAssets = {
    persistProviderVideo: jest.fn(async (sourceUrl?: string) => {
      if (!sourceUrl) return null;
      const response = await fetch(sourceUrl);
      if (!response.ok) return null;
      const buffer = Buffer.from(await response.arrayBuffer());
      const result = await r2Service.uploadBuffer(buffer, {
        contentType: 'video/mp4',
        folder: 'amux-studio/video-generations',
        ext: 'mp4',
      });
      return result.publicUrl;
    }),
  };
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
  const riskService = {
    assertVideoRequest: jest.fn(async () => ({ active: 0, limit: 4 })),
    assertHardLimits: jest.fn(() => { }),
    assertConcurrency: jest.fn(async () => ({ active: 0, limit: 4 })),
  };
  const projectStatusConvergence = {
    recalculateProjectStatus: jest.fn(async () => undefined),
    convergeAfterClipFailure: jest.fn(async () => undefined),
    cascadeFailDependents: jest.fn(async () => undefined),
  };
  const holdReconciliation = new VideoGenerationHoldReconciliationService(
    pointsService as never,
  );
  const terminalConvergence = new VideoGenerationTerminalConvergenceService(
    holdReconciliation,
  );
  const repository = new VideoGenerationRepository(prisma as never);

  const service = new VideoGenerationFlowService(
    repository,
    pointsService as never,
    modelResolver as never,
    seedanceApi as never,
    callbackUrlBuilder as never,
    videoAssets as never,
    membershipService as never,
    riskService as never,
    projectStatusConvergence as never,
    holdReconciliation,
    terminalConvergence,
  );

  return {
    service,
    prisma,
    pointsService,
    r2Service,
    modelConfigService,
    modelResolver,
    seedanceApi,
    callbackUrlBuilder,
    videoAssets,
    membershipService,
    riskService,
    projectStatusConvergence,
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
        taskType: 'video_generation',
        resolution: '720p',
        seconds: 5,
        usesTemplate: false,
        referenceImages: 1,
      }),
    );
    expect(pointsService.createHold).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        taskType: 'video_generation',
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

  it('generates a storyboard project as one complete video task', async () => {
    const projectClips = [
      {
        id: 'clip-1',
        projectId: 'project-1',
        order: 1,
        title: '开场',
        prompt: '赛博朋克城市远景',
        params: {
          modelConfigId: 'model-config-1',
          resolution: '720p',
          duration: 2,
          ratio: '16:9',
          generationMode: 'storyboard',
          storyboardPrompt: '完整赛博朋克短片',
        },
        status: VideoClipStatus.pending,
        chainFromPrev: false,
      },
      {
        id: 'clip-2',
        projectId: 'project-1',
        order: 2,
        title: '特写',
        prompt: '红衣少女半身近景',
        params: {
          modelConfigId: 'model-config-1',
          resolution: '720p',
          duration: 3,
          ratio: '16:9',
          generationMode: 'storyboard',
          storyboardPrompt: '完整赛博朋克短片',
        },
        status: VideoClipStatus.pending,
        chainFromPrev: true,
      },
    ];
    const { service, prisma, seedanceApi, pointsService } = makeService({
      projectClips,
    });
    prisma.video_projects.findUnique.mockResolvedValue({
      id: 'project-1',
      userId: 'user-1',
    });

    await service.generateAllClips('project-1', 'user-1');

    expect(seedanceApi.createTask).toHaveBeenCalledTimes(1);
    const createTaskCalls = seedanceApi.createTask.mock.calls as unknown as Array<
      [string, { duration: number; content: Array<{ text?: string }> }]
    >;
    const taskRequest = createTaskCalls.at(-1)?.[1] as {
      duration: number;
      content: Array<{ text?: string }>;
    };
    expect(taskRequest.duration).toBe(5);
    expect(taskRequest.content[0].text).toContain('完整分镜脚本');
    expect(taskRequest.content[0].text).toContain('分镜 1「开场」：赛博朋克城市远景');
    expect(taskRequest.content[0].text).toContain('分镜 2「特写」：红衣少女半身近景');
    expect(pointsService.estimateCost).toHaveBeenCalledWith(
      expect.objectContaining({ seconds: 5 }),
    );
    expect(prisma.video_clip_generations.create).toHaveBeenCalledTimes(1);
    expect(prisma.video_clips.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: 'project-1' },
        data: { status: VideoClipStatus.generating },
      }),
    );
  });

  it('uses the total duration of all storyboard clips for entitlement, risk, billing, and provider request', async () => {
    const projectClips = [
      {
        id: 'clip-1',
        projectId: 'project-1',
        order: 1,
        title: '开场',
        prompt: '雨夜城市远景',
        params: {
          modelConfigId: 'model-config-1',
          resolution: '1080p',
          duration: 1.2,
          ratio: '16:9',
          generationMode: 'storyboard',
          storyboardPrompt: '完整赛博朋克短片',
        },
        status: VideoClipStatus.pending,
        chainFromPrev: false,
      },
      {
        id: 'clip-2',
        projectId: 'project-1',
        order: 2,
        title: '推进',
        prompt: '镜头推向少女',
        params: {
          modelConfigId: 'model-config-1',
          resolution: '1080p',
          duration: 2.1,
          ratio: '16:9',
          generationMode: 'storyboard',
          storyboardPrompt: '完整赛博朋克短片',
        },
        status: VideoClipStatus.pending,
        chainFromPrev: true,
      },
      {
        id: 'clip-3',
        projectId: 'project-1',
        order: 3,
        title: '收束',
        prompt: '摩托驶离路口',
        params: {
          modelConfigId: 'model-config-1',
          resolution: '1080p',
          duration: 3,
          ratio: '16:9',
          generationMode: 'storyboard',
          storyboardPrompt: '完整赛博朋克短片',
        },
        status: VideoClipStatus.pending,
        chainFromPrev: true,
      },
    ];
    const {
      service,
      prisma,
      seedanceApi,
      pointsService,
      membershipService,
      riskService,
    } = makeService({ projectClips });
    prisma.video_projects.findUnique.mockResolvedValue({
      id: 'project-1',
      userId: 'user-1',
    });

    await service.generateAllClips('project-1', 'user-1');

    expect(membershipService.assertVideoEntitlement).toHaveBeenCalledWith(
      expect.any(Object),
      {
        resolution: '1080p',
        durationSeconds: 7,
      },
    );
    expect(riskService.assertVideoRequest).toHaveBeenCalledWith(
      'user-1',
      expect.any(Object),
      {
        resolution: '1080p',
        durationSeconds: 7,
      },
    );
    expect(pointsService.estimateCost).toHaveBeenCalledWith(
      expect.objectContaining({
        resolution: '1080p',
        seconds: 7,
      }),
    );
    expect(seedanceApi.createTask).toHaveBeenCalledTimes(1);
    const createTaskCalls = seedanceApi.createTask.mock.calls as unknown as Array<
      [string, { duration: number; content: Array<{ text?: string }> }]
    >;
    const taskRequest = createTaskCalls.at(-1)?.[1];
    expect(taskRequest).toBeDefined();
    if (!taskRequest) throw new Error('expected Seedance task request');
    expect(taskRequest.duration).toBe(7);
    expect(taskRequest.content).toHaveLength(1);
    expect(taskRequest.content[0].text).toContain('分镜 1「开场」：雨夜城市远景');
    expect(taskRequest.content[0].text).toContain('分镜 2「推进」：镜头推向少女');
    expect(taskRequest.content[0].text).toContain('分镜 3「收束」：摩托驶离路口');
  });

  it('sends five storyboard clips as one Seedance text content item, not five provider tasks', async () => {
    const projectClips = Array.from({ length: 5 }, (_, index) => ({
      id: `clip-${index + 1}`,
      projectId: 'project-1',
      order: index + 1,
      title: `镜头${index + 1}`,
      prompt: `第 ${index + 1} 个分镜内容`,
      params: {
        modelConfigId: 'model-config-1',
        resolution: '720p',
        duration: 2,
        ratio: '16:9',
        generationMode: 'storyboard',
        storyboardPrompt: '五镜头完整短片',
      },
      status: VideoClipStatus.pending,
      chainFromPrev: index > 0,
    }));
    const { service, prisma, seedanceApi, pointsService } = makeService({
      projectClips,
    });
    prisma.video_projects.findUnique.mockResolvedValue({
      id: 'project-1',
      userId: 'user-1',
    });

    await service.generateAllClips('project-1', 'user-1');

    expect(seedanceApi.createTask).toHaveBeenCalledTimes(1);
    const createTaskCalls = seedanceApi.createTask.mock.calls as unknown as Array<
      [string, { duration: number; content: Array<{ type: string; text?: string }> }]
    >;
    const taskRequest = createTaskCalls.at(-1)?.[1];
    expect(taskRequest).toBeDefined();
    if (!taskRequest) throw new Error('expected Seedance task request');
    expect(taskRequest.duration).toBe(10);
    expect(taskRequest.content).toEqual([
      {
        type: 'text',
        text: expect.stringContaining('完整分镜脚本'),
      },
    ]);
    for (let index = 1; index <= 5; index += 1) {
      expect(taskRequest.content[0].text).toContain(
        `分镜 ${index}「镜头${index}」：第 ${index} 个分镜内容`,
      );
    }
    expect(pointsService.estimateCost).toHaveBeenCalledTimes(1);
    expect(pointsService.estimateCost).toHaveBeenCalledWith(
      expect.objectContaining({ seconds: 10 }),
    );
    expect(prisma.video_clip_generations.create).toHaveBeenCalledTimes(1);
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
    const { service, prisma, pointsService, seedanceApi, projectStatusConvergence } =
      makeService();
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
    expect(prisma.point_holds.findFirst).toHaveBeenCalledWith({
      where: { taskId: holdInput!.taskId },
      orderBy: { createdAt: 'desc' },
    });
    expect(pointsService.refundHoldWithinTx).toHaveBeenCalledWith(
      prisma,
      'hold-1',
      'createTask 同步失败',
    );
    expect(
      projectStatusConvergence.recalculateProjectStatus,
    ).toHaveBeenCalledWith('project-1');
  });

  it('confirms the frozen points after successful video persistence', async () => {
    const { service, pointsService, r2Service, projectStatusConvergence } =
      makeService();
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
    expect(pointsService.confirmHoldWithinTx).toHaveBeenCalledWith(
      expect.any(Object),
      'hold-1',
    );
    expect(pointsService.refundHold).not.toHaveBeenCalled();
    expect(
      projectStatusConvergence.recalculateProjectStatus,
    ).toHaveBeenCalledWith('project-1');

    global.fetch = originalFetch;
  });

  it('does not mark video completed when point confirmation fails', async () => {
    const { service, prisma, pointsService } = makeService();
    pointsService.confirmHoldWithinTx.mockRejectedValue(
      new Error('ledger confirm failed'),
    );
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    }) as never;

    await expect(
      service.applyTaskStatus(
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
      ),
    ).rejects.toThrow('ledger confirm failed');

    expect(prisma.video_clip_generations.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: VideoGenStatus.completed }),
      }),
    );

    global.fetch = originalFetch;
  });

  it('refunds the frozen points when Seedance reports failure', async () => {
    const { service, pointsService, projectStatusConvergence } = makeService();

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

    expect(pointsService.refundHoldWithinTx).toHaveBeenCalledWith(
      expect.any(Object),
      'hold-1',
      '视频生成失败: provider rejected',
    );
    expect(pointsService.confirmHold).not.toHaveBeenCalled();
    expect(
      projectStatusConvergence.convergeAfterClipFailure,
    ).toHaveBeenCalledWith({
      clipId: 'clip-1',
      projectId: 'project-1',
    });
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

});
