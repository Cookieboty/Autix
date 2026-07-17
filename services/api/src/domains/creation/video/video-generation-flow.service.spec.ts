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

// 计划 4 · Task 2：提交路径切到协议引擎，不再经 SeedanceApiService.buildContent/
// buildTaskRequest/createTask（切换后它们不再被调用，见下方
// "submits through the protocol engine" 用例）。只 mock submitVideoTask 本身
// ——resolveVideoPreset/assembleVideoRequest 仍跑真实实现，断言的是引擎真正收到
// 的入参，而不是一个手写 mock 对协议的复述。vi.mock 会被提升到本文件顶部，
// 工厂不能直接闭包外层 const，故用 vi.hoisted 提升这个 mock 本身。
//
// 计划 4 · Task 3：轮询/回调也切到引擎，同理只 mock queryVideoTask 本身
// ——resolveVideoPreset/normalizeVideoOutcome 仍跑真实实现。
const { submitVideoTaskMock, queryVideoTaskMock } = vi.hoisted(() => ({
  submitVideoTaskMock: vi.fn(async () => ({ providerTaskId: 'seedance-task-1' })),
  queryVideoTaskMock: vi.fn(async () => ({ kind: 'active', externalStatus: 'queued' })),
}));

vi.mock('@autix/ai-adapters/video', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@autix/ai-adapters/video')>();
  return {
    ...actual,
    submitVideoTask: submitVideoTaskMock,
    queryVideoTask: queryVideoTaskMock,
  };
});

function makeService(options: {
  clip?: Record<string, any>;
  projectClips?: Array<Record<string, any>>;
  modelConfig?: Record<string, any>;
} = {}) {
  // 每个测试独立的 submitVideoTask/queryVideoTask 调用记录/默认实现——mock 本身是
  // 模块级共享的（vi.mock 提升所致），每个 makeService() 调用都要清空上一个用例留下的痕迹。
  submitVideoTaskMock.mockClear();
  submitVideoTaskMock.mockImplementation(async () => ({ providerTaskId: 'seedance-task-1' }));
  queryVideoTaskMock.mockClear();
  queryVideoTaskMock.mockImplementation(async () => ({ kind: 'active', externalStatus: 'queued' }));

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
    $transaction: vi.fn(async (callback: any) => callback(prisma)),
    video_clips: {
      findUnique: vi.fn(async (args: any) => {
        if (args.where?.id === 'clip-1') return clip;
        if (args.where?.projectId_order) return null;
        return null;
      }),
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(async (args: any) => {
        if (args.where?.projectId === 'project-1' && args.orderBy?.order === 'asc') {
          return options.projectClips ?? [clip];
        }
        if (args.where?.order?.gt != null) return [];
        return [{ status: VideoClipStatus.failed }];
      }),
    },
    video_projects: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    video_clip_generations: {
      create: vi.fn(async (args: any) => ({
        id: args.data.id,
        clipId: 'clip-1',
        projectId: 'project-1',
        userId: 'user-1',
        status: VideoGenStatus.pending,
      })),
      update: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(async (): Promise<any[]> => []),
    },
    point_holds: {
      findFirst: vi.fn(async () => ({
        id: 'hold-1',
        userId: 'user-1',
        status: PointHoldStatus.PENDING,
      })),
    },
  };
  const pointsService = {
    estimateCost: vi.fn(async () => ({
      estimatedCost: 1600,
      taskType: 'video_generation',
      modelConfigId: 'model-config-1',
      breakdown: [],
      pricingSnapshot: { ruleId: 'rule-video' },
    })),
    createHold: vi.fn(async () => ({
      hold: { id: 'hold-1' },
      balance: 4900,
    })),
    findPendingHoldByTask: vi.fn(async () => ({ id: 'hold-1', userId: 'user-1' })),
    confirmHold: vi.fn(async () => ({
      confirmed: true,
      hold: { id: 'hold-1', userId: 'user-1', status: PointHoldStatus.CONFIRMED },
      balance: 3300,
    })),
    confirmHoldWithinTx: vi.fn(async () => ({
      confirmed: true,
      hold: { id: 'hold-1', userId: 'user-1', status: PointHoldStatus.CONFIRMED },
      balance: 3300,
    })),
    refundHold: vi.fn(async () => ({
      refunded: true,
      amount: 1600,
      balance: 6500,
    })),
    refundHoldWithinTx: vi.fn(async () => ({
      refunded: true,
      amount: 1600,
      balance: 6500,
    })),
  };
  const r2Service = {
    uploadBuffer: vi.fn(async (_buffer: Buffer, _opts: any) => ({
      publicUrl: 'https://cdn.test/video.mp4',
    })),
  };
  const modelConfigService = {
    findDefaultByType: vi.fn(async (_type: ModelType) => ({
      id: 'model-config-1',
      name: 'Seedance',
      model: options.modelConfig?.model ?? 'seedance-pro',
      // 引擎切换后 preset 从 modelConfig.metadata.protocolKey 路由（resolveVideoPreset
      // 对缺失/未注册的 key fail-loud）——所有生产视频模型都配了它，这里的默认值
      // 镜像现网唯一协议 'ark-video@v3'。
      metadata: { protocolKey: 'ark-video@v3' },
      ...options.modelConfig,
    })),
    getConfigForOrchestrator: vi.fn(async (id: string) => ({
      id,
      model: 'seedance-pro',
      baseUrl: null,
      apiKey: 'video-key',
      metadata: { protocolKey: 'ark-video@v3' },
      ...options.modelConfig,
    })),
  };
  const seedanceApi = {
    buildContent: vi.fn((materials: any[], prompt: string) => [
      { type: 'text', text: prompt },
      ...materials.map((material) => ({
        type: 'image_url',
        image_url: { url: material.url },
      })),
    ]),
    buildTaskRequest: vi.fn((opts: any) => ({
      model: opts.model,
      content: opts.content,
      resolution: opts.resolution,
      ratio: opts.ratio,
      duration: opts.duration,
    })),
    createTask: vi.fn(async () => ({ id: 'seedance-task-1' })),
    queryTask: vi.fn(),
  };
  const modelResolver = {
    resolveForGeneration: vi.fn(async () => {
      // 无兜底：clip 必须显式带 modelConfigId，缺失即拒绝（与 resolver 真身一致）。
      const modelConfigId = (clip.params as { modelConfigId?: string }).modelConfigId;
      if (!modelConfigId) {
        throw new Error('该分镜未指定视频模型，请先选择模型');
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
    getApiKeyForClipParams: vi.fn(async (params: any) => {
      const modelConfigId = params?.modelConfigId;
      if (!modelConfigId) return null;
      const modelConfig =
        await modelConfigService.getConfigForOrchestrator(modelConfigId);
      return modelConfig.apiKey ?? null;
    }),
    getApiKeyForClipParamsOrThrow: vi.fn(async (params: any) => {
      const modelConfigId = params?.modelConfigId;
      if (!modelConfigId) throw new Error('Clip 未配置模型，无法刷新');
      const modelConfig =
        await modelConfigService.getConfigForOrchestrator(modelConfigId);
      if (!modelConfig.apiKey) throw new Error('视频模型缺少 API Key 配置');
      return modelConfig.apiKey;
    }),
    resolveApiContextForClipParams: vi.fn(async (params: any) => {
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
        metadata: modelConfig.metadata,
      };
    }),
    // 计划 4 · Task 3：轮询/回调/手动刷新按提交时快照的 modelConfigId 直接解析凭证。
    resolveApiContextByModelConfigId: vi.fn(async (modelConfigId: string) => {
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
    resolveApiContextForClipParamsOrThrow: vi.fn(async (params: any) => {
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
  const callbackUrlBuilder = { build: vi.fn(() => undefined) };
  const videoAssets = {
    persistProviderVideo: vi.fn(async (sourceUrl?: string) => {
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
    resolveVideoEntitlements: vi.fn(async () => ({
      enabled: true,
      maxResolution: '1080p' as const,
      maxDurationSeconds: 30,
      concurrency: 4,
      levelName: 'Pro',
      level: 3,
      source: 'membership' as const,
    })),
    assertVideoEntitlement: vi.fn(() => { }),
  };
  const riskService = {
    assertVideoRequest: vi.fn(async () => ({ active: 0, limit: 4 })),
    assertHardLimits: vi.fn(() => { }),
    assertConcurrency: vi.fn(async () => ({ active: 0, limit: 4 })),
  };
  const projectStatusConvergence = {
    recalculateProjectStatus: vi.fn(async () => undefined),
    convergeAfterClipFailure: vi.fn(async () => undefined),
    cascadeFailDependents: vi.fn(async () => undefined),
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
    repository,
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
    submitVideoTaskMock,
    queryVideoTaskMock,
  };
}

describe('VideoGenerationFlowService billing', () => {
  it('freezes configurable Seedance points before creating the generation and provider task', async () => {
    const { service, prisma, pointsService, submitVideoTaskMock } = makeService();
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
    submitVideoTaskMock.mockImplementation(async () => {
      order.push('provider');
      return { providerTaskId: 'seedance-task-1' };
    });

    const result = await service.generateClip({
      clipId: 'clip-1',
      projectId: 'project-1',
      userId: 'user-1',
    });

    // Exact shape (not objectContaining): pins the new task/params contract —
    // resolution/seconds/ratio live under `params`, modelConfigId is present
    // because generateClip always has one in scope by this point, and there is
    // no referenceImages/hasVideoInput/hasAudioInput (not part of the `video`
    // pricing preset's paramsSchema) and no top-level resolution/seconds.
    expect(pointsService.estimateCost).toHaveBeenCalledWith({
      taskType: 'video_generation',
      modelConfigId: 'model-config-1',
      params: {
        resolution: '720p',
        seconds: 5,
        ratio: '16:9',
      },
      membershipLevel: 3,
    });
    expect(pointsService.createHold).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        taskType: 'video_generation',
        taskId: result.generationId,
        amount: 1600,
        pricingSnapshot: { ruleId: 'rule-video' },
      }),
    );
    // refundPolicy is dead — createHold must never receive a refundPolicySnapshot
    // (not even a fabricated `{}`) for the video-generation charge path.
    const holdCallArgsForOrder = (
      pointsService.createHold.mock.calls as unknown as Array<[string, Record<string, unknown>]>
    ).at(-1)?.[1];
    expect(holdCallArgsForOrder).not.toHaveProperty('refundPolicySnapshot');
    expect(order).toEqual(['hold', 'generation', 'provider']);
    expect(result).toEqual({
      generationId: expect.any(String),
      taskId: 'seedance-task-1',
    });
  });

  it('persists the protocol/model snapshot when creating a generation', async () => {
    // repository 是真实实例（见本文件 :276），不是 mock —— 用 spyOn 并让它继续调用真实实现，
    // 这样断言的是 flow 真正传下去的入参，而不是一个替身的记录。
    const { service, repository } = makeService();
    const createSpy = vi.spyOn(repository, 'createPendingGenerationAndMarkRunning');

    await service.generateClip({
      clipId: 'clip-1',
      projectId: 'project-1',
      userId: 'user-1',
    });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        protocolKey: 'ark-video@v3',
        modelConfigId: 'model-config-1',
      }),
    );
  });

  it('combines storyboard prompt and clip prompt for storyboard generation', async () => {
    const { service, prisma, submitVideoTaskMock } = makeService({
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
    expect(submitVideoTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: resolvedPrompt }),
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
        materials: [],
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
        materials: [],
      },
    ];
    const { service, prisma, submitVideoTaskMock, pointsService } = makeService({
      projectClips,
    });
    prisma.video_projects.findUnique.mockResolvedValue({
      id: 'project-1',
      userId: 'user-1',
    });

    await service.generateAllClips('project-1', 'user-1');

    expect(submitVideoTaskMock).toHaveBeenCalledTimes(1);
    const submitCalls = submitVideoTaskMock.mock.calls as unknown as Array<
      [{ params: { seconds?: number }; prompt?: string | null }]
    >;
    const callRequest = submitCalls.at(-1)?.[0];
    expect(callRequest?.params.seconds).toBe(5);
    expect(callRequest?.prompt).toContain('完整分镜脚本');
    expect(callRequest?.prompt).toContain('分镜 1「开场」：赛博朋克城市远景');
    expect(callRequest?.prompt).toContain('分镜 2「特写」：红衣少女半身近景');
    // Exact shape: the second (storyboard) estimateCost call site also uses the
    // task/params contract, with the modelConfigId resolved for the storyboard.
    expect(pointsService.estimateCost).toHaveBeenCalledWith({
      taskType: 'video_generation',
      modelConfigId: 'model-config-1',
      params: {
        resolution: '720p',
        seconds: 5,
        ratio: '16:9',
      },
      membershipLevel: 3,
    });
    expect(prisma.video_clip_generations.create).toHaveBeenCalledTimes(1);
    expect(prisma.video_clips.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: 'project-1' },
        data: { status: VideoClipStatus.generating },
      }),
    );
  });

  it('persists the protocol/model snapshot for storyboard project generations', async () => {
    // Same legacy-row gap as generateClip, but for the storyboard branch: it calls
    // a *different* repository method (createPendingProjectGenerationAndMarkRunning,
    // not createPendingGenerationAndMarkRunning), which grepping for the latter alone
    // would miss. repository is a real instance (see makeService) — spyOn keeps the
    // real implementation so the assertion is on what the flow actually passes down.
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
        materials: [],
      },
    ];
    const { service, repository, prisma } = makeService({ projectClips });
    prisma.video_projects.findUnique.mockResolvedValue({
      id: 'project-1',
      userId: 'user-1',
    });
    const createProjectSpy = vi.spyOn(
      repository,
      'createPendingProjectGenerationAndMarkRunning',
    );

    await service.generateAllClips('project-1', 'user-1');

    expect(createProjectSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        protocolKey: 'ark-video@v3',
        modelConfigId: 'model-config-1',
      }),
    );
  });

  it('passes storyboard clip materials into the single provider task', async () => {
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
        materials: [
          {
            id: 'mat-1',
            clipId: 'clip-1',
            role: 'first_frame',
            sourceType: 'upload',
            sourceId: null,
            url: 'https://img.test/a.png',
            name: 'A',
            metadata: null,
            createdAt: new Date(),
          },
          {
            id: 'mat-2',
            clipId: 'clip-1',
            role: 'last_frame',
            sourceType: 'upload',
            sourceId: null,
            url: 'https://img.test/b.png',
            name: 'B',
            metadata: null,
            createdAt: new Date(),
          },
        ],
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
        materials: [
          {
            id: 'mat-3',
            clipId: 'clip-2',
            role: 'first_frame',
            sourceType: 'upload',
            sourceId: null,
            url: 'https://img.test/b.png',
            name: 'B',
            metadata: null,
            createdAt: new Date(),
          },
          {
            id: 'mat-4',
            clipId: 'clip-2',
            role: 'last_frame',
            sourceType: 'upload',
            sourceId: null,
            url: 'https://img.test/c.png',
            name: 'C',
            metadata: null,
            createdAt: new Date(),
          },
        ],
      },
    ];
    const { service, prisma, submitVideoTaskMock } = makeService({ projectClips });
    prisma.video_projects.findUnique.mockResolvedValue({
      id: 'project-1',
      userId: 'user-1',
    });

    await service.generateAllClips('project-1', 'user-1');

    expect(submitVideoTaskMock).toHaveBeenCalledTimes(1);
    const submitCalls = submitVideoTaskMock.mock.calls as unknown as Array<
      [{ materials: Array<{ role: string; url: string }>; prompt?: string | null }]
    >;
    const callRequest = submitCalls.at(-1)?.[0];
    // 引擎的 VideoMaterialInput 只认 { role, url }——素材现在直接传（不再经
    // seedanceApi.buildContent 转 content item），故断言的是引擎实际收到的素材数组。
    expect(callRequest?.materials).toEqual([
      expect.objectContaining({ role: 'first_frame', url: 'https://img.test/a.png' }),
      expect.objectContaining({ role: 'last_frame', url: 'https://img.test/b.png' }),
      expect.objectContaining({ role: 'first_frame', url: 'https://img.test/b.png' }),
      expect.objectContaining({ role: 'last_frame', url: 'https://img.test/c.png' }),
    ]);
    expect(callRequest?.prompt).toContain('完整分镜脚本');
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
      submitVideoTaskMock,
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
        params: expect.objectContaining({
          resolution: '1080p',
          seconds: 7,
        }),
      }),
    );
    expect(submitVideoTaskMock).toHaveBeenCalledTimes(1);
    const submitCalls = submitVideoTaskMock.mock.calls as unknown as Array<
      [{ params: { seconds?: number }; prompt?: string | null }]
    >;
    const callRequest = submitCalls.at(-1)?.[0];
    expect(callRequest).toBeDefined();
    if (!callRequest) throw new Error('expected submitVideoTask call');
    expect(callRequest.params.seconds).toBe(7);
    expect(callRequest.prompt).toContain('分镜 1「开场」：雨夜城市远景');
    expect(callRequest.prompt).toContain('分镜 2「推进」：镜头推向少女');
    expect(callRequest.prompt).toContain('分镜 3「收束」：摩托驶离路口');
  });

  it('clamps unsupported Seedance fast resolutions before entitlement, billing, and provider request', async () => {
    const { service, membershipService, riskService, pointsService, submitVideoTaskMock } = makeService({
      clip: {
        params: {
          modelConfigId: 'model-config-1',
          resolution: '1080p',
          duration: 5,
          ratio: '16:9',
        },
      },
      modelConfig: {
        model: 'doubao-seedance-2.0-fast',
        provider: 'amux',
      },
    });

    await service.generateClip({
      clipId: 'clip-1',
      projectId: 'project-1',
      userId: 'user-1',
    });

    expect(membershipService.assertVideoEntitlement).toHaveBeenCalledWith(
      expect.any(Object),
      {
        resolution: '720p',
        durationSeconds: 5,
      },
    );
    expect(riskService.assertVideoRequest).toHaveBeenCalledWith(
      'user-1',
      expect.any(Object),
      {
        resolution: '720p',
        durationSeconds: 5,
      },
    );
    // Pricing identifies the model via modelConfigId, never by re-deriving it
    // from the resolved model name (doubao-seedance-2.0-fast is the Seedance
    // model id, not a pricing identity — see task-15 brief on not reverse-
    // looking-up a model by name).
    expect(pointsService.estimateCost).toHaveBeenCalledWith(
      expect.objectContaining({
        modelConfigId: 'model-config-1',
        params: expect.objectContaining({
          resolution: '720p',
        }),
      }),
    );
    // baseUrl 未配置（modelConfig.baseUrl = null）——旧路径里这条兜底藏在
    // seedanceApi 内部的 resolveSeedanceBaseUrl，切引擎后由调用方
    // resolveEngineBaseUrl 显式兜底到 Ark 的公有默认 host，逐字节保持一致。
    expect(submitVideoTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'video-key',
        baseUrl: 'https://ark.cn-beijing.volces.com',
        params: expect.objectContaining({ resolution: '720p' }),
      }),
    );
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
    const { service, prisma, submitVideoTaskMock, pointsService } = makeService({
      projectClips,
    });
    prisma.video_projects.findUnique.mockResolvedValue({
      id: 'project-1',
      userId: 'user-1',
    });

    await service.generateAllClips('project-1', 'user-1');

    expect(submitVideoTaskMock).toHaveBeenCalledTimes(1);
    const submitCalls = submitVideoTaskMock.mock.calls as unknown as Array<
      [{ materials: unknown[]; params: { seconds?: number }; prompt?: string | null }]
    >;
    const callRequest = submitCalls.at(-1)?.[0];
    expect(callRequest).toBeDefined();
    if (!callRequest) throw new Error('expected submitVideoTask call');
    expect(callRequest.params.seconds).toBe(10);
    // 五个分镜都没有 materials，故素材数组为空——一条纯文本 content item，不是五个。
    expect(callRequest.materials).toEqual([]);
    for (let index = 1; index <= 5; index += 1) {
      expect(callRequest.prompt).toContain(
        `分镜 ${index}「镜头${index}」：第 ${index} 个分镜内容`,
      );
    }
    expect(pointsService.estimateCost).toHaveBeenCalledTimes(1);
    expect(pointsService.estimateCost).toHaveBeenCalledWith(
      expect.objectContaining({ params: expect.objectContaining({ seconds: 10 }) }),
    );
    expect(prisma.video_clip_generations.create).toHaveBeenCalledTimes(1);
  });

  it('refunds the hold when local generation creation fails after freezing points', async () => {
    const { service, prisma, pointsService, submitVideoTaskMock } = makeService();
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
    expect(submitVideoTaskMock).not.toHaveBeenCalled();
  });

  it('refunds the frozen points when provider task creation fails', async () => {
    const { service, prisma, pointsService, submitVideoTaskMock, projectStatusConvergence } =
      makeService();
    submitVideoTaskMock.mockRejectedValue(new Error('Seedance unavailable'));

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
    global.fetch = vi.fn().mockResolvedValue({
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
        kind: 'succeeded',
        externalStatus: 'succeeded',
        sourceUrl: 'https://provider.test/video.mp4',
        lastFrameUrl: null,
        durationSec: 5,
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
    global.fetch = vi.fn().mockResolvedValue({
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
          kind: 'succeeded',
          externalStatus: 'succeeded',
          sourceUrl: 'https://provider.test/video.mp4',
          lastFrameUrl: null,
          durationSec: 5,
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
        kind: 'failed',
        externalStatus: 'failed',
        error: 'provider rejected',
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
      { kind: 'succeeded', externalStatus: 'succeeded', lastFrameUrl: null, durationSec: null },
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
      { kind: 'failed', externalStatus: 'failed', error: 'n/a' },
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
    const { service, membershipService, pointsService, submitVideoTaskMock } =
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
    expect(submitVideoTaskMock).not.toHaveBeenCalled();
  });

  it('propagates estimateCost failures on the clip path without a fallback price (no hold, no provider task)', async () => {
    const { service, pointsService, submitVideoTaskMock } = makeService();
    pointsService.estimateCost.mockRejectedValueOnce(
      new Error('任务未配置: video_generation'),
    );

    await expect(
      service.generateClip({
        clipId: 'clip-1',
        projectId: 'project-1',
        userId: 'user-1',
      }),
    ).rejects.toThrow('任务未配置: video_generation');

    // No fallback on a charging path: a thrown estimate must never be caught
    // and substituted with a hold/price computed another way.
    expect(pointsService.createHold).not.toHaveBeenCalled();
    expect(submitVideoTaskMock).not.toHaveBeenCalled();
  });

  it('propagates estimateCost failures on the storyboard project path without a fallback price', async () => {
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
        materials: [],
      },
    ];
    const { service, prisma, pointsService, submitVideoTaskMock } = makeService({
      projectClips,
    });
    prisma.video_projects.findUnique.mockResolvedValue({
      id: 'project-1',
      userId: 'user-1',
    });
    pointsService.estimateCost.mockRejectedValueOnce(
      new Error('模型未找到: model-config-1'),
    );

    await expect(
      service.generateAllClips('project-1', 'user-1'),
    ).rejects.toThrow('模型未找到: model-config-1');

    expect(pointsService.createHold).not.toHaveBeenCalled();
    expect(submitVideoTaskMock).not.toHaveBeenCalled();
  });

  it('submits through the protocol engine, not SeedanceApiService', async () => {
    const { service, seedanceApi } = makeService();

    await service.generateClip({
      clipId: 'clip-1',
      projectId: 'project-1',
      userId: 'user-1',
    });

    // 旧实现的三个入口都不该再被调用——它们下个 Task 就要被删掉了。
    expect(seedanceApi.buildContent).not.toHaveBeenCalled();
    expect(seedanceApi.buildTaskRequest).not.toHaveBeenCalled();
    expect(seedanceApi.createTask).not.toHaveBeenCalled();
  });

  it('sends the server-resolved model, never params.model', async () => {
    // 安全不变量（buildSeedanceTaskRequestOptions:329-331 记着这笔账，现由
    // toUnifiedVideoParams 天然维持——它不投影 model）：防「选便宜模型过鉴权、
    // 用 params.model 偷换成贵模型」→ 跑贵付便宜。
    const { service, submitVideoTaskMock } = makeService({
      clip: {
        params: { model: 'some-expensive-model' },
      },
      modelConfig: { model: 'doubao-seedance-2.0-fast' },
    });

    await service.generateClip({
      clipId: 'clip-1',
      projectId: 'project-1',
      userId: 'user-1',
    });

    expect(submitVideoTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'doubao-seedance-2.0-fast' }),
    );
    const receivedModel = (
      submitVideoTaskMock.mock.calls as unknown as Array<[{ model: string }]>
    ).at(-1)?.[0].model;
    expect(receivedModel).not.toBe('some-expensive-model');
  });

});

// 计划 4 · Task 3：轮询切到引擎 + 用提交时的快照凭证，而非实时 clip params。
describe('VideoGenerationFlowService polling', () => {
  function makePollableGeneration(overrides: Record<string, any> = {}) {
    return {
      id: 'gen-1',
      clipId: 'clip-1',
      projectId: 'project-1',
      userId: 'user-1',
      model: 'seedance-pro',
      protocolKey: 'ark-video@v3',
      modelConfigId: 'model-config-1',
      providerTaskId: 'seedance-task-1',
      status: VideoGenStatus.queued,
      createdAt: new Date(),
      params: {},
      ...overrides,
    };
  }

  // 快照优先：用户中途改 clip 模型不能影响 in-flight 任务的查询凭证
  // （clip params 生成后仍可改，video-project.store.ts 的 updateClipParams）。
  it('polls using the submitted-time snapshot, not live clip params', async () => {
    const { service, prisma, modelResolver, queryVideoTaskMock } = makeService({
      // 实时 params 指向另一个模型 —— 若实现读它，resolveApiContextByModelConfigId
      // 就不会被以 'model-config-1' 调用，这条会红。
      clip: { params: { modelConfigId: 'model-config-2', model: 'some-other-model' } },
    });
    const generation = makePollableGeneration();
    prisma.video_clip_generations.findMany.mockResolvedValue([generation]);

    await service.pollPendingGenerations();

    expect(modelResolver.resolveApiContextByModelConfigId).toHaveBeenCalledWith(
      'model-config-1',
    );
    expect(queryVideoTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 'seedance-task-1' }),
    );
  });

  // 受限回退：legacy 行（无快照）且实时配置已漂移 → 拒绝查询，交给超时收敛。
  // 宁可慢，不可拿另一家的凭证去查旧任务。
  it('refuses to query a legacy row whose live config drifted away from Ark', async () => {
    const { service, prisma, modelResolver, queryVideoTaskMock } = makeService();
    const generation = makePollableGeneration({
      protocolKey: null,
      modelConfigId: null,
    });
    prisma.video_clip_generations.findMany.mockResolvedValue([generation]);
    modelResolver.resolveApiContextForClipParams.mockResolvedValue({
      apiKey: 'k',
      baseUrl: 'https://other',
      modelConfigId: 'm2',
      model: 'seedance-pro',
      metadata: { protocolKey: 'kling-video@v1' }, // 漂移到别家
    } as any);
    const errorSpy = vi
      .spyOn((service as unknown as { logger: { error(m: string): void } }).logger, 'error')
      .mockImplementation(() => undefined);

    await service.pollPendingGenerations();

    expect(queryVideoTaskMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('cross-channel'));
  });

  // 残余 legacy 行未漂移（实时配置仍是 Ark 且模型一致）——受限回退放行，正常轮询。
  it('allows a legacy row to poll when the live config has not drifted', async () => {
    const { service, prisma, modelResolver, queryVideoTaskMock } = makeService();
    const generation = makePollableGeneration({
      protocolKey: null,
      modelConfigId: null,
      model: 'seedance-pro',
    });
    prisma.video_clip_generations.findMany.mockResolvedValue([generation]);
    modelResolver.resolveApiContextForClipParams.mockResolvedValue({
      apiKey: 'video-key',
      baseUrl: null,
      modelConfigId: 'model-config-1',
      model: 'seedance-pro',
      metadata: { protocolKey: 'ark-video@v3' },
    });

    await service.pollPendingGenerations();

    expect(queryVideoTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 'seedance-task-1', apiKey: 'video-key' }),
    );
  });
});

// 计划 4 · Task 3：回调切到 (protocolKey, taskId) 两列定位 + 引擎解析。
describe('VideoGenerationFlowService callback routing', () => {
  it('resolves the generation by (protocolKey, taskId) and applies the parsed outcome', async () => {
    const { service, prisma, pointsService } = makeService();
    prisma.video_clip_generations.findFirst.mockResolvedValue({
      id: 'gen-1',
      clipId: 'clip-1',
      projectId: 'project-1',
      userId: 'user-1',
      model: 'seedance-pro',
      protocolKey: 'ark-video@v3',
      modelConfigId: 'model-config-1',
      status: VideoGenStatus.queued,
      params: {},
    });
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    }) as never;

    await service.handleCallback('ark-video@v3', 'seedance-task-1', {
      id: 'seedance-task-1',
      status: 'succeeded',
      video_url: 'https://provider.test/video.mp4',
      duration: 5,
    });

    expect(prisma.video_clip_generations.findFirst).toHaveBeenCalledWith({
      where: { protocolKey: 'ark-video@v3', providerTaskId: 'seedance-task-1' },
    });
    expect(pointsService.confirmHoldWithinTx).toHaveBeenCalled();

    global.fetch = originalFetch;
  });

  it('warns and no-ops when the callback references an unknown task', async () => {
    const { service, prisma, pointsService } = makeService();
    prisma.video_clip_generations.findFirst.mockResolvedValue(null);

    await service.handleCallback('ark-video@v3', 'unknown-task', {
      id: 'unknown-task',
      status: 'succeeded',
    });

    expect(pointsService.confirmHoldWithinTx).not.toHaveBeenCalled();
  });
});
