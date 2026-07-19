import {
  VideoClipStatus,
  VideoGenStatus,
  VideoMaterialRole,
  VideoMaterialSourceType,
} from '../../platform/prisma/generated';
import {
  SUCCEEDED_MISSING_VIDEO_URL_REASON,
  SUCCEEDED_VIDEO_PERSIST_FAILED_REASON,
  buildChainFirstFrameInput,
  buildCompletedGenerationInput,
  buildCreateTaskFailureInput,
  buildExpiredGenerationInput,
  buildExplicitFailedGenerationInput,
  buildFailedGenerationInput,
  buildPendingGenerationInput,
  buildQueuedGenerationPollWindow,
  buildSeedanceCostEstimateInput,
  buildVideoHoldInput,
  getFirstPendingClip,
  getPendingHeadClips,
  normalizeVideoDuration,
  normalizeVideoResolution,
  presentGenerateAllClipResults,
  redactProviderRequest,
  resolveClipPrompt,
  resolveVideoPricingTaskType,
  resolveGenerateAllClipPlan,
  resolveGenerationMaterials,
  resolveStoryboardTotalDuration,
  resolveStoryboardVideoPrompt,
  resolveSucceededGenerationFailureReason,
  resolveSucceededGenerationVideo,
  resolveVideoGenerateAudio,
  resolveVideoGenerationRequestLimits,
  splitQueuedGenerationsForPolling,
  summarizeDurations,
  summarizeSeedanceContent,
} from './video-generation-flow.helpers';

describe('video generation flow helpers', () => {
  it('combines storyboard and clip prompts without changing existing labels', () => {
    expect(
      resolveClipPrompt('当前镜头', {
        generationMode: 'storyboard',
        storyboardPrompt: '整片风格',
      }),
    ).toBe('整片提示词：整片风格\n\n当前分镜提示词：当前镜头');

    expect(
      resolveClipPrompt('当前镜头', {
        generationMode: 'single',
        storyboardPrompt: 'ignored',
      }),
    ).toBe('当前分镜提示词：当前镜头');
  });

  it('normalizes generation parameters for entitlement and billing checks', () => {
    expect(normalizeVideoResolution('1080P')).toBe('1080p');
    expect(normalizeVideoResolution('480')).toBe('480p');
    expect(normalizeVideoResolution(undefined)).toBe('720p');

    expect(normalizeVideoDuration(4.2)).toBe(5);
    expect(normalizeVideoDuration(-1)).toBe(5);
    expect(normalizeVideoDuration(undefined)).toBe(5);

    expect(
      resolveVideoGenerationRequestLimits({
        resolution: '1080P',
        duration: 4.2,
      }),
    ).toEqual({
      resolution: '1080p',
      durationSeconds: 5,
    });
  });

  it('resolves storyboard total duration from every clip before rounding once', () => {
    expect(
      resolveStoryboardTotalDuration([
        { params: { duration: 1.2 } },
        { params: { duration: 2.1 } },
        { params: { duration: 3 } },
      ]),
    ).toBe(7);

    expect(
      resolveStoryboardTotalDuration([
        { params: { duration: 2.4 } },
        { params: { duration: 2.4 } },
      ]),
    ).toBe(5);
  });

  it('ignores invalid storyboard clip durations and falls back only when none are valid', () => {
    expect(
      resolveStoryboardTotalDuration(
        [
          { params: { duration: 2 } },
          { params: { duration: 0 } },
          { params: { duration: -3 } },
          { params: { duration: 'bad' } },
          { params: null },
        ],
        9,
      ),
    ).toBe(2);

    expect(
      resolveStoryboardTotalDuration(
        [
          { params: { duration: 0 } },
          { params: { duration: -3 } },
          { params: { duration: 'bad' } },
          { params: null },
        ],
        4.2,
      ),
    ).toBe(5);
  });

  it('builds one storyboard prompt containing every storyboard in order', () => {
    expect(
      resolveStoryboardVideoPrompt({
        params: {
          generationMode: 'storyboard',
          storyboardPrompt: '统一电影感，雨夜霓虹',
        },
        clips: [
          { order: 3, title: '收束', prompt: '摩托驶离街区' },
          { order: 1, title: '开场', prompt: '城市远景' },
          { order: 2, title: '特写', prompt: '红衣少女抬头' },
        ],
      }),
    ).toBe(
      '整片提示词：统一电影感，雨夜霓虹\n\n完整分镜脚本：\n分镜 1「开场」：城市远景\n分镜 2「特写」：红衣少女抬头\n分镜 3「收束」：摩托驶离街区',
    );
  });

  it('sends a single clip prompt verbatim — no 分镜脚本 scaffolding even under forced storyboard mode', () => {
    // generateAllClips 对单条 clip 也会强制 generationMode='storyboard'；这条锁死：
    // 单条 + 无整片提示词时，原样透传用户 prompt，绝不包成「完整分镜脚本 / 分镜 1「x」：x」。
    expect(
      resolveStoryboardVideoPrompt({
        params: { generationMode: 'storyboard' },
        clips: [{ order: 1, title: '骑摩托的妹子', prompt: '骑摩托的妹子' }],
      }),
    ).toBe('骑摩托的妹子');
  });

  it('keeps the 整片提示词 when a single clip has a global storyboard prompt', () => {
    // 单条但有整片提示词：仍需带上整片风格，不能只发 clip prompt。
    expect(
      resolveStoryboardVideoPrompt({
        params: { generationMode: 'storyboard', storyboardPrompt: '雨夜霓虹' },
        clips: [{ order: 1, title: '开场', prompt: '城市远景' }],
      }),
    ).toBe('整片提示词：雨夜霓虹\n\n完整分镜脚本：\n分镜 1「开场」：城市远景');
  });

  it('resolves generate_audio params with existing precedence', () => {
    expect(
      resolveVideoGenerateAudio({
        generateAudio: false,
        generate_audio: true,
      }),
    ).toBe(false);
    expect(resolveVideoGenerateAudio({ generate_audio: true })).toBe(true);
    expect(resolveVideoGenerateAudio({})).toBeUndefined();
  });

  it('resolves video pricing to the stable video task type', () => {
    expect(resolveVideoPricingTaskType({ resolution: '1080p' }, 'seedance-fast')).toBe('video_generation');
    expect(resolveVideoPricingTaskType({ resolution: '480p' }, 'seedance-pro')).toBe('video_generation');
    expect(resolveVideoPricingTaskType({ resolution: '720p' }, 'seedance-fast')).toBe('video_generation');
    expect(resolveVideoPricingTaskType({ resolution: '720p' }, 'seedance-pro')).toBe('video_generation');
  });

  it('builds queued generation poll windows and splits queued generations', () => {
    // 排水窗口 65min（晚于积分侧孤儿回收的 60min 退款）：now=02:05 → expireBefore=01:00。
    const now = new Date('2026-01-01T02:05:00.000Z');
    const window = buildQueuedGenerationPollWindow(now);
    expect(window).toEqual({
      expireBefore: new Date('2026-01-01T01:00:00.000Z'),
    });

    const expired = {
      id: 'gen-expired',
      createdAt: new Date('2026-01-01T00:59:59.999Z'),
      providerTaskId: 'task-expired',
    };
    const pollable = {
      id: 'gen-pollable',
      createdAt: new Date('2026-01-01T01:00:00.000Z'),
      providerTaskId: 'task-pollable',
    };
    const missingTask = {
      id: 'gen-missing-task',
      createdAt: new Date('2026-01-01T01:20:00.000Z'),
      providerTaskId: null,
    };

    expect(
      splitQueuedGenerationsForPolling(
        [expired, pollable, missingTask],
        window,
      ),
    ).toEqual({
      toExpire: [expired],
      toPoll: [pollable],
    });
  });

  it('summarizes Seedance content (an inert content-shape utility, no longer wired into pricing)', () => {
    const content = [
      { type: 'text' as const, text: 'prompt' },
      { type: 'image_url' as const, image_url: { url: 'https://img.test/1.png' } },
      { type: 'image_url' as const, image_url: { url: 'https://img.test/2.png' } },
      { type: 'video_url' as const, video_url: { url: 'https://vid.test/in.mp4' } },
      { type: 'audio_url' as const, audio_url: { url: 'https://aud.test/in.mp3' } },
    ];

    expect(summarizeSeedanceContent(content)).toEqual({
      referenceImages: 2,
      hasVideoInput: true,
      hasAudioInput: true,
    });
  });

  describe('buildSeedanceCostEstimateInput', () => {
    it('packs resolution/duration/ratio into params under the task/params contract, with modelConfigId when known', () => {
      expect(
        buildSeedanceCostEstimateInput({
          params: { resolution: '1080P', duration: 5.2, ratio: '9:16', sourceTemplateId: 'tpl-1' },
          modelConfigId: 'model-config-1',
          membershipLevel: 3,
        }),
      ).toEqual({
        taskType: 'video_generation',
        modelConfigId: 'model-config-1',
        params: {
          resolution: '1080p',
          duration: 6,
          ratio: '9:16',
        },
        membershipLevel: 3,
      });
    });

    it('omits ratio, modelConfigId and membershipLevel when not provided, and never guesses a pointCostWeight-style value', () => {
      const result = buildSeedanceCostEstimateInput({
        params: { resolution: '720p', duration: 5 },
      });

      expect(result).toEqual({
        taskType: 'video_generation',
        params: {
          resolution: '720p',
          duration: 5,
        },
      });
      expect(result).not.toHaveProperty('modelConfigId');
      expect(result).not.toHaveProperty('membershipLevel');
      expect(result.params).not.toHaveProperty('ratio');
      // video params are only what the `video` pricing preset declares
      // (resolution/duration/ratio) — no referenceImages/hasVideoInput/hasAudioInput,
      // those never appear in the video preset's paramsSchema.
      expect(result.params).not.toHaveProperty('referenceImages');
      expect(result.params).not.toHaveProperty('hasVideoInput');
      expect(result.params).not.toHaveProperty('hasAudioInput');
    });
  });

  it('builds video hold input with preserved metadata and remark shape, and never sends a refundPolicySnapshot', () => {
    const result = buildVideoHoldInput({
      billingTaskType: 'video_generation',
      generationId: 'gen-1',
      estimatedCost: 1600,
      pricingSnapshot: { ruleId: 'rule-video', drop: undefined },
      projectId: 'project-1',
      clipId: 'clip-1',
      modelConfigId: 'model-config-1',
      taskRequest: {
        model: 'seedance-pro',
        content: [{ type: 'text', text: 'prompt' }],
        duration: 5,
      },
    });

    expect(result).toEqual({
      taskType: 'video_generation',
      taskId: 'gen-1',
      amount: 1600,
      pricingSnapshot: { ruleId: 'rule-video' },
      metadata: {
        projectId: 'project-1',
        clipId: 'clip-1',
        modelConfigId: 'model-config-1',
        seedanceTaskRequest: {
          model: 'seedance-pro',
          content: [{ type: 'text', text: 'prompt' }],
          duration: 5,
        },
      },
      remark: 'video-generation',
    });
    // refundPolicy is dead (39 old rules all NULL, refundHold never reads the
    // snapshot) — an impl that fabricates `{}` here must fail this assertion.
    expect(result).not.toHaveProperty('refundPolicySnapshot');
  });

  it('builds chained first-frame input only when the previous generation has a last frame', () => {
    const createdAt = new Date('2026-01-01T00:00:02.000Z');

    expect(
      buildChainFirstFrameInput({
        clipId: 'clip-2',
        previousGeneration: null,
        createdAt,
      }),
    ).toBeNull();
    expect(
      buildChainFirstFrameInput({
        clipId: 'clip-2',
        previousGeneration: {
          id: 'gen-prev',
          lastFrameUrl: null,
        },
        createdAt,
      }),
    ).toBeNull();
    expect(
      buildChainFirstFrameInput({
        clipId: 'clip-2',
        previousGeneration: {
          id: 'gen-prev',
          lastFrameUrl: 'https://cdn.test/last.png',
        },
        createdAt,
      }),
    ).toEqual({
      clipId: 'clip-2',
      generationId: 'gen-prev',
      lastFrameUrl: 'https://cdn.test/last.png',
      createdAt,
    });
  });

  it('replaces manual first-frame material with chained previous generation output', () => {
    const manualFirstFrame = {
      id: 'mat-first',
      clipId: 'clip-1',
      role: VideoMaterialRole.first_frame,
      sourceType: VideoMaterialSourceType.upload,
      sourceId: null,
      url: 'https://img.test/manual.png',
      name: 'Manual first frame',
      metadata: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const referenceImage = {
      id: 'mat-ref',
      clipId: 'clip-1',
      role: VideoMaterialRole.reference_image,
      sourceType: VideoMaterialSourceType.upload,
      sourceId: null,
      url: 'https://img.test/ref.png',
      name: 'Reference',
      metadata: null,
      createdAt: new Date('2026-01-01T00:00:01.000Z'),
    };
    const chainedCreatedAt = new Date('2026-01-01T00:00:02.000Z');

    expect(
      resolveGenerationMaterials([manualFirstFrame, referenceImage], null),
    ).toEqual([manualFirstFrame, referenceImage]);
    expect(
      resolveGenerationMaterials([manualFirstFrame, referenceImage], {
        clipId: 'clip-1',
        generationId: 'gen-prev',
        lastFrameUrl: 'https://cdn.test/last.png',
        createdAt: chainedCreatedAt,
      }),
    ).toEqual([
      {
        id: 'chain_first_frame',
        clipId: 'clip-1',
        role: VideoMaterialRole.first_frame,
        sourceType: VideoMaterialSourceType.video_generation,
        sourceId: 'gen-prev',
        url: 'https://cdn.test/last.png',
        name: 'Auto from previous clip',
        metadata: null,
        createdAt: chainedCreatedAt,
      },
      referenceImage,
    ]);
  });

  it('resolves succeeded task fallback failure reasons', () => {
    expect(
      resolveSucceededGenerationFailureReason({
        sourceUrl: undefined,
      }),
    ).toBe(SUCCEEDED_MISSING_VIDEO_URL_REASON);
    expect(
      resolveSucceededGenerationFailureReason({
        sourceUrl: 'https://provider.test/video.mp4',
        persistedVideoUrl: null,
        persistAttempted: true,
      }),
    ).toBe(SUCCEEDED_VIDEO_PERSIST_FAILED_REASON);
    expect(
      resolveSucceededGenerationFailureReason({
        sourceUrl: 'https://provider.test/video.mp4',
        persistedVideoUrl: 'https://cdn.test/video.mp4',
        persistAttempted: true,
      }),
    ).toBeNull();
    expect(
      resolveSucceededGenerationVideo({
        sourceUrl: 'https://provider.test/video.mp4',
        persistedVideoUrl: 'https://cdn.test/video.mp4',
        persistAttempted: true,
      }),
    ).toEqual({
      kind: 'ready',
      videoUrl: 'https://cdn.test/video.mp4',
    });
  });

  it('builds repository inputs for generation creation and provider failure', () => {
    const taskRequest = {
      model: 'seedance-pro',
      content: [{ type: 'text' as const, text: 'prompt' }],
      duration: 5,
    };

    expect(
      buildPendingGenerationInput({
        generationId: 'gen-1',
        clipId: 'clip-1',
        projectId: 'project-1',
        userId: 'user-1',
        variantLabel: 'A',
        params: { model: 'seedance-fast' },
        fallbackModel: 'seedance-pro',
        resolvedPrompt: 'prompt',
        taskRequest,
      }),
    ).toEqual({
      generationId: 'gen-1',
      clipId: 'clip-1',
      projectId: 'project-1',
      userId: 'user-1',
      variantLabel: 'A',
      // FIX-3: 记录服务端解析的 model（seedance-pro），不采信 params.model。
      model: 'seedance-pro',
      resolvedPrompt: 'prompt',
      params: taskRequest,
    });

    expect(
      buildPendingGenerationInput({
        generationId: 'gen-1',
        clipId: 'clip-1',
        projectId: 'project-1',
        userId: 'user-1',
        params: {},
        fallbackModel: 'seedance-pro',
        resolvedPrompt: 'prompt',
        taskRequest,
      }).model,
    ).toBe('seedance-pro');

    expect(
      buildCreateTaskFailureInput({
        generationId: 'gen-1',
        clipId: 'clip-1',
        error: new Error('provider down'),
      }),
    ).toEqual({
      generationId: 'gen-1',
      clipId: 'clip-1',
      error: 'provider down',
    });
    expect(
      buildCreateTaskFailureInput({
        generationId: 'gen-1',
        clipId: 'clip-1',
        error: 'provider down',
      }).error,
    ).toBe('Unknown error creating task');
  });

  it('builds repository inputs for task status convergence', () => {
    const generation = {
      id: 'gen-1',
      clipId: 'clip-1',
    };

    expect(
      buildCompletedGenerationInput({
        generation,
        outcome: {
          kind: 'succeeded',
          externalStatus: 'succeeded',
          sourceUrl: 'https://provider.test/video.mp4',
          lastFrameUrl: 'https://provider.test/last.png',
          durationSec: 6,
        },
        videoUrl: 'https://cdn.test/video.mp4',
      }),
    ).toEqual({
      generationId: 'gen-1',
      clipId: 'clip-1',
      externalStatus: 'succeeded',
      videoUrl: 'https://cdn.test/video.mp4',
      lastFrameUrl: 'https://provider.test/last.png',
      durationSec: 6,
    });

    expect(
      buildFailedGenerationInput({
        generation,
        outcome: {
          kind: 'failed',
          externalStatus: 'failed',
          generationStatus: VideoGenStatus.failed,
          error: 'provider rejected',
          refundReason: '视频生成失败: provider rejected',
        },
      }),
    ).toEqual({
      generationId: 'gen-1',
      clipId: 'clip-1',
      status: VideoGenStatus.failed,
      externalStatus: 'failed',
      error: 'provider rejected',
    });

    expect(
      buildExplicitFailedGenerationInput({
        generation,
        reason: 'callback succeeded but video_url missing',
        externalStatus: 'succeeded',
      }),
    ).toEqual({
      generationId: 'gen-1',
      clipId: 'clip-1',
      status: VideoGenStatus.failed,
      externalStatus: 'succeeded',
      error: 'callback succeeded but video_url missing',
    });

    expect(
      buildExpiredGenerationInput({
        generation,
        reason: 'cron: queued 超过 30 分钟未完成',
      }),
    ).toEqual({
      generationId: 'gen-1',
      clipId: 'clip-1',
      status: VideoGenStatus.expired,
      externalStatus: 'expired',
      error: 'cron: queued 超过 30 分钟未完成',
    });
  });

  it('selects generate-all candidates and presents successful results', () => {
    const clips = [
      {
        id: 'clip-1',
        chainFromPrev: false,
        status: VideoClipStatus.pending,
      },
      {
        id: 'clip-2',
        chainFromPrev: true,
        status: VideoClipStatus.pending,
      },
      {
        id: 'clip-3',
        chainFromPrev: false,
        status: VideoClipStatus.completed,
      },
    ];

    expect(getPendingHeadClips(clips)).toEqual([clips[0]]);
    expect(getFirstPendingClip(clips)).toBe(clips[0]);
    expect(resolveGenerateAllClipPlan(clips)).toEqual({
      kind: 'parallel_heads',
      clips: [clips[0]],
    });
    expect(resolveGenerateAllClipPlan([clips[2], clips[1]])).toEqual({
      kind: 'single_fallback',
      clip: clips[1],
    });
    expect(resolveGenerateAllClipPlan([clips[2]])).toEqual({
      kind: 'none',
    });
    expect(
      presentGenerateAllClipResults([
        { generationId: 123, taskId: 'task-1', clipId: 'clip-1' },
        null,
      ]),
    ).toEqual([{ generationId: '123', taskId: 'task-1', clipId: 'clip-1' }]);
  });
});

describe('redactProviderRequest', () => {
  it('masks callback_url (含 VIDEO_CALLBACK_SECRET) 但不改其他字段', () => {
    const body = { model: 'ark', content: [{ type: 'text' }], callback_url: 'https://cb/x?token=secret' };
    const redacted = redactProviderRequest(body);
    expect(redacted.callback_url).toBe('[REDACTED]');
    expect(redacted.model).toBe('ark');
    expect(redacted.content).toBe(body.content);
    // 返回浅拷贝，不改原对象（原对象仍带真实 token 发给上游）。
    expect(body.callback_url).toBe('https://cb/x?token=secret');
  });

  it('无 callback_url 时原样返回', () => {
    const body = { model: 'poyo', input: { prompt: 'x' } };
    expect(redactProviderRequest(body)).toBe(body);
  });
});

describe('summarizeDurations', () => {
  it('空数组返回 0/0，避免除零', () => {
    expect(summarizeDurations([])).toEqual({ p50: 0, p95: 0 });
  });

  it('单元素时 p50 与 p95 都等于该值', () => {
    expect(summarizeDurations([200])).toEqual({ p50: 200, p95: 200 });
  });

  it('对无序输入先排序后按 nearest-rank 取分位', () => {
    // 1..10 排好序后：p50 -> idx=ceil(5)-1=4 => 5；p95 -> idx=ceil(9.5)-1=9 => 10
    const durations = [10, 3, 8, 1, 5, 2, 7, 9, 6, 4];
    expect(summarizeDurations(durations)).toEqual({ p50: 5, p95: 10 });
  });
});
