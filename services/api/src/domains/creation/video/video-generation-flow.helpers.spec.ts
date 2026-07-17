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
  buildSeedanceTaskRequestOptions,
  buildVideoHoldInput,
  getFirstPendingClip,
  getPendingHeadClips,
  normalizeSeedanceTaskOutcome,
  normalizeVideoDuration,
  normalizeVideoResolution,
  presentGenerateAllClipResults,
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

  it('builds Seedance task request options from clip params without provider side effects', () => {
    const content = [{ type: 'text' as const, text: 'prompt' }];

    expect(
      buildSeedanceTaskRequestOptions({
        params: {
          model: 'seedance-fast',
          resolution: '480p',
          ratio: '9:16',
          duration: 6,
          seed: 123,
          generate_audio: true,
          watermark: true,
        },
        model: 'seedance-pro',
        content,
        callbackUrl: 'https://api.test/callback',
        returnLastFrame: true,
      }),
    ).toEqual({
      // FIX-3: 始终使用服务端解析的 model（seedance-pro），忽略客户端 params.model（seedance-fast）。
      model: 'seedance-pro',
      content,
      callbackUrl: 'https://api.test/callback',
      returnLastFrame: true,
      generateAudio: true,
      resolution: '480p',
      ratio: '9:16',
      duration: 6,
      seed: 123,
      watermark: true,
    });
  });

  it('builds queued generation poll windows and splits queued generations', () => {
    const now = new Date('2026-01-01T00:40:00.000Z');
    const window = buildQueuedGenerationPollWindow(now);
    expect(window).toEqual({
      expireBefore: new Date('2026-01-01T00:10:00.000Z'),
    });

    const expired = {
      id: 'gen-expired',
      createdAt: new Date('2026-01-01T00:09:59.999Z'),
      providerTaskId: 'task-expired',
    };
    const pollable = {
      id: 'gen-pollable',
      createdAt: new Date('2026-01-01T00:10:00.000Z'),
      providerTaskId: 'task-pollable',
    };
    const missingTask = {
      id: 'gen-missing-task',
      createdAt: new Date('2026-01-01T00:20:00.000Z'),
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
    it('packs resolution/seconds/ratio into params under the task/params contract, with modelConfigId when known', () => {
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
          seconds: 6,
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
          seconds: 5,
        },
      });
      expect(result).not.toHaveProperty('modelConfigId');
      expect(result).not.toHaveProperty('membershipLevel');
      expect(result.params).not.toHaveProperty('ratio');
      // video params are only what the `video` pricing preset declares
      // (resolution/seconds/ratio) — no referenceImages/hasVideoInput/hasAudioInput,
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

  it('normalizes Seedance task outcome for callback and refresh convergence', () => {
    expect(normalizeSeedanceTaskOutcome({})).toEqual({
      kind: 'missing_status',
    });
    expect(
      normalizeSeedanceTaskOutcome({
        status: 'succeeded',
        content: {
          video_url: 'https://provider.test/video.mp4',
          last_frame_url: 'https://provider.test/last.png',
        },
        duration: 5,
      }),
    ).toEqual({
      kind: 'succeeded',
      externalStatus: 'succeeded',
      sourceUrl: 'https://provider.test/video.mp4',
      lastFrameUrl: 'https://provider.test/last.png',
      durationSec: 5,
    });
    expect(
      normalizeSeedanceTaskOutcome({
        status: 'failed',
        error: { message: 'provider rejected' },
      }),
    ).toEqual({
      kind: 'failed',
      externalStatus: 'failed',
      generationStatus: VideoGenStatus.failed,
      error: 'provider rejected',
      refundReason: '视频生成失败: provider rejected',
    });
    expect(normalizeSeedanceTaskOutcome({ status: 'expired' })).toEqual({
      kind: 'failed',
      externalStatus: 'expired',
      generationStatus: VideoGenStatus.expired,
      error: 'expired',
      refundReason: '视频生成超时',
    });
    expect(normalizeSeedanceTaskOutcome({ status: 'running' })).toEqual({
      kind: 'active',
      externalStatus: 'running',
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
