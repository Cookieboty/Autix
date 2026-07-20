import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { VideoUpstreamError } from '@autix/ai-adapters/video';
import { VideoDirectGenerationService } from './video-direct-generation.service';

// 同 video-generation-flow.service.spec.ts 的装配风格：只 mock submitVideoTask 本身，
// resolveVideoPreset/assembleVideoRequest 仍跑真实实现——断言的是引擎真正收到的入参，
// 不是一个手写 mock 对协议的复述。vi.mock 提升到本文件顶部，工厂不能闭包外层 const，
// 故用 vi.hoisted 提升这个 mock 本身。
const { submitVideoTaskMock } = vi.hoisted(() => ({
  submitVideoTaskMock: vi.fn(async () => ({ providerTaskId: 'direct-task-1' })),
}));

vi.mock('@autix/ai-adapters/video', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@autix/ai-adapters/video')>();
  return {
    ...actual,
    submitVideoTask: submitVideoTaskMock,
  };
});

function validInput(overrides: Partial<Parameters<VideoDirectGenerationService['generate']>[0]> = {}) {
  return {
    userId: 'u1',
    prompt: 'a cinematic shot',
    materials: [],
    clientParams: { modelConfigId: 'model-config-1' },
    ...overrides,
  };
}

function makeService(
  options: {
    modelResolver?: Record<string, any>;
    repo?: Record<string, any>;
    hold?: Record<string, any>;
    pointsService?: Record<string, any>;
    membershipService?: Record<string, any>;
    riskService?: Record<string, any>;
    submitVideoTask?: (...args: any[]) => Promise<any>;
  } = {},
) {
  submitVideoTaskMock.mockClear();
  submitVideoTaskMock.mockImplementation(
    options.submitVideoTask ?? (async () => ({ providerTaskId: 'direct-task-1' })),
  );

  const defaultModelConfig = {
    id: 'model-config-1',
    model: 'seedance-pro',
    provider: 'volcengine',
    baseUrl: null,
    apiKey: 'video-key',
    metadata: { protocolKey: 'ark-video@v3' },
  };

  const modelResolver = {
    resolveForGeneration: vi.fn(async () => ({
      modelConfigId: 'model-config-1',
      modelConfig: defaultModelConfig,
      apiKey: 'video-key',
      baseUrl: null,
    })),
    ...options.modelResolver,
  };

  const pointsService = {
    estimateCost: vi.fn(async () => ({
      estimatedCost: 1600,
      pricingSnapshot: { ruleId: 'rule-video' },
    })),
    createHold: vi.fn(async () => ({ hold: { id: 'hold-1' }, balance: 4900 })),
    ...options.pointsService,
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
    assertVideoEntitlement: vi.fn(() => {}),
    ...options.membershipService,
  };

  const riskService = {
    assertVideoRequest: vi.fn(async () => ({ active: 0, limit: 4 })),
    ...options.riskService,
  };

  const callbackUrlBuilder = { build: vi.fn(() => 'https://cb.test/callback') };

  const repository = {
    createDirectPendingGeneration: vi.fn(async () => undefined),
    markGenerationQueued: vi.fn(async () => undefined),
    markDirectGenerationFailed: vi.fn(async () => true),
    ...options.repo,
  };

  const holdReconciliation = {
    // safeRefund 现在回报成败（供 billingStatus 区分 REFUNDED / REFUND_FAILED）。
    safeRefund: vi.fn(async () => ({ ok: true })),
    ...options.hold,
  };

  const taskRecorder = {
    start: vi.fn(async () => undefined),
    queued: vi.fn(async () => undefined),
    succeed: vi.fn(async () => true),
    fail: vi.fn(async () => true),
    recordBilling: vi.fn(async () => undefined),
    recordLateCallback: vi.fn(async () => undefined),
  };

  const service = new VideoDirectGenerationService(
    repository as never,
    pointsService as never,
    modelResolver as never,
    callbackUrlBuilder as never,
    membershipService as never,
    riskService as never,
    holdReconciliation as never,
    taskRecorder as never,
  );

  return {
    service,
    repository,
    taskRecorder,
    pointsService,
    modelResolver,
    membershipService,
    riskService,
    callbackUrlBuilder,
    holdReconciliation,
  };
}

describe('VideoDirectGenerationService.generate', () => {
  it('模型解析带 userId（越权模型抛 Forbidden）', async () => {
    const resolveForGeneration = vi.fn().mockRejectedValue(new ForbiddenException('该模型不可用'));
    const { service } = makeService({ modelResolver: { resolveForGeneration } });

    await expect(
      service.generate({ userId: 'u1', prompt: 'p', materials: [], clientParams: { modelConfigId: 'mc1' } }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(resolveForGeneration).toHaveBeenCalledWith(expect.anything(), 'u1'); // userId 必传
  });

  it('submit 成功、markGenerationQueued 失败 → 不退款不标失败', async () => {
    const markQueued = vi.fn().mockRejectedValue(new Error('db down'));
    const safeRefund = vi.fn(async () => ({ ok: true }));
    const markDirectGenerationFailed = vi.fn(async () => true);
    const { service } = makeService({
      submitVideoTask: async () => ({ providerTaskId: 't1' }),
      repo: { markGenerationQueued: markQueued, markDirectGenerationFailed },
      hold: { safeRefund },
    });

    await expect(service.generate(validInput())).rejects.toThrow('db down');

    expect(safeRefund).not.toHaveBeenCalled(); // 上游在跑，交孤儿回收
    expect(markDirectGenerationFailed).not.toHaveBeenCalled();
  });

  it('上游明确拒绝（4xx httpStatus）→ 退款 + 标失败', async () => {
    const safeRefund = vi.fn(async () => ({ ok: true }));
    const markDirectGenerationFailed = vi.fn(async () => true);
    const { service } = makeService({
      submitVideoTask: async () => {
        throw new VideoUpstreamError({
          message: 'rejected',
          classification: 'content-policy',
          httpStatus: 422,
          retryable: false,
        });
      },
      repo: { markDirectGenerationFailed },
      hold: { safeRefund },
    });

    await expect(service.generate(validInput())).rejects.toThrow('rejected');

    expect(safeRefund).toHaveBeenCalledWith(expect.any(String), 'upstream rejected');
    expect(markDirectGenerationFailed).toHaveBeenCalled();
  });

  it('提交失败（不确定：网络/超时）→ 保 hold，不退款也不标失败', async () => {
    const safeRefund = vi.fn(async () => ({ ok: true }));
    const markDirectGenerationFailed = vi.fn(async () => true);
    const { service } = makeService({
      submitVideoTask: async () => {
        throw new Error('network timeout');
      },
      repo: { markDirectGenerationFailed },
      hold: { safeRefund },
    });

    await expect(service.generate(validInput())).rejects.toThrow('network timeout');

    expect(safeRefund).not.toHaveBeenCalled();
    expect(markDirectGenerationFailed).not.toHaveBeenCalled();
  });

  it('提交失败（无 task id：VideoUpstreamError 且无 httpStatus）→ 确定性失败 → 退款 + 标失败', async () => {
    // 收到了上游响应但没给任务 id → 无 id 可轮询、不可能恢复，必须立即关闭（否则一直挂 pending）。
    const safeRefund = vi.fn(async () => ({ ok: true }));
    const markDirectGenerationFailed = vi.fn(async () => true);
    const { service } = makeService({
      submitVideoTask: async () => {
        throw new VideoUpstreamError({
          message: 'upstream video submit returned no task id',
          classification: 'upstream',
          retryable: false,
        });
      },
      repo: { markDirectGenerationFailed },
      hold: { safeRefund },
    });

    await expect(service.generate(validInput())).rejects.toThrow(
      'upstream video submit returned no task id',
    );

    expect(markDirectGenerationFailed).toHaveBeenCalled();
    expect(safeRefund).toHaveBeenCalled();
  });

  // Task 7.5：调用方层的 CAS 契约。仓储的 CAS 守住了 generation 行，但 safeRefund 在
  // 仓储之外 —— 输家若继续退款，就是重复退款（凭空发积分）。Task 7 的 Critical 正是
  // 这种「仓储守住、调用方一步之遥泄漏」。
  it('CAS 输家（markDirectGenerationFailed 返回 false）不退款，但仍向上抛错', async () => {
    const safeRefund = vi.fn(async () => ({ ok: true }));
    const markDirectGenerationFailed = vi.fn(async () => false);
    const { service } = makeService({
      submitVideoTask: async () => {
        throw new VideoUpstreamError({
          message: 'rejected',
          classification: 'content-policy',
          httpStatus: 422,
          retryable: false,
        });
      },
      repo: { markDirectGenerationFailed },
      hold: { safeRefund },
    });

    // throw err 无条件保留：它是本次调用自身失败的传播路径，与 CAS 胜负无关。
    // 改成 return 会让上游拒绝静默成功返回（Task 7 认定的反模式）。
    await expect(service.generate(validInput())).rejects.toThrow('rejected');

    expect(markDirectGenerationFailed).toHaveBeenCalled();
    expect(safeRefund).not.toHaveBeenCalled();
  });

  /**
   * Task 8 回归：直连提交成功后必须把 generation_tasks 推进到 QUEUED。
   *
   * 这条断言存在的理由：删掉 service 里的 `taskRecorder.queued(...)` 那一行，
   * 视频行照样被 markGenerationQueued 写成 queued，返回值也完全正确 ——
   * 除了本用例，全仓没有任何测试会因此变红，任务表会静默停在 PENDING。
   */
  it('提交成功 → generation_tasks 也推进到 QUEUED，且带上 providerTaskId', async () => {
    const { service, taskRecorder } = makeService({
      submitVideoTask: async () => ({ providerTaskId: 'direct-task-1' }),
    });

    const result = await service.generate(validInput());

    expect(taskRecorder.queued).toHaveBeenCalledWith(result.generationId, 'direct-task-1');
  });

  it('提交成功 → 直连落库、返回 generationId + taskId，且不携带父 clip/project', async () => {
    const { service, repository, pointsService } = makeService({
      submitVideoTask: async () => ({ providerTaskId: 'direct-task-1' }),
    });

    const result = await service.generate(validInput());

    expect(result).toEqual({ generationId: expect.any(String), taskId: 'direct-task-1' });
    expect(repository.createDirectPendingGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: result.generationId,
        userId: 'u1',
        model: 'seedance-pro',
        protocolKey: 'ark-video@v3',
        modelConfigId: 'model-config-1',
      }),
    );
    expect(repository.markGenerationQueued).toHaveBeenCalledWith(result.generationId, 'direct-task-1');
    expect(pointsService.createHold).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        taskId: result.generationId,
        metadata: expect.objectContaining({ projectId: null, clipId: null }),
      }),
    );
  });

  it('强制 model=modelConfig.model、generationMode=standard，忽略客户端传入值', async () => {
    const svc = makeService({
      modelResolver: {
        resolveForGeneration: vi.fn(async (clip: { params: Record<string, unknown> }) => {
          // 断言传给 resolver 的 params 已被强制 standard，且 model 已被剔除。
          expect(clip.params.generationMode).toBe('standard');
          expect(clip.params.model).toBeUndefined();
          return {
            modelConfigId: 'model-config-1',
            modelConfig: {
              id: 'model-config-1',
              model: 'doubao-seedance-2.0-fast',
              provider: 'volcengine',
              baseUrl: null,
              apiKey: 'video-key',
              metadata: { protocolKey: 'ark-video@v3' },
            },
            apiKey: 'video-key',
            baseUrl: null,
          };
        }),
      },
      submitVideoTask: async (req: { model: string }) => {
        expect(req.model).toBe('doubao-seedance-2.0-fast');
        return { providerTaskId: 'direct-task-2' };
      },
    });

    await svc.service.generate(
      validInput({ clientParams: { modelConfigId: 'model-config-1', model: 'some-expensive-model', generationMode: 'storyboard' } }),
    );
  });

  it('落库失败（提交前）→ 退款', async () => {
    const safeRefund = vi.fn(async () => ({ ok: true }));
    const createDirectPendingGeneration = vi.fn().mockRejectedValue(new Error('db down before submit'));
    const { service } = makeService({
      repo: { createDirectPendingGeneration },
      hold: { safeRefund },
    });

    await expect(service.generate(validInput())).rejects.toThrow('db down before submit');

    expect(safeRefund).toHaveBeenCalledWith(expect.any(String), 'direct generation persist failed');
  });

  it('缺少 prompt 时直接拒绝，不创建 hold', async () => {
    const { service, pointsService } = makeService();

    await expect(service.generate(validInput({ prompt: '   ' }))).rejects.toBeInstanceOf(BadRequestException);
    expect(pointsService.createHold).not.toHaveBeenCalled();
  });
});
