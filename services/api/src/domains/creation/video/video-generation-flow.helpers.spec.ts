import { VideoClipStatus, VideoGenStatus } from '../../platform/prisma/generated';
import {
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
  resolveSeedancePricingTaskType,
  resolveVideoGenerateAudio,
  resolveVideoGenerationRequestLimits,
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

  it('resolves Seedance pricing task type with existing precedence', () => {
    expect(resolveSeedancePricingTaskType({ resolution: '1080p' }, 'seedance-fast')).toBe('seedance_1080p');
    expect(resolveSeedancePricingTaskType({ resolution: '480p' }, 'seedance-pro')).toBe('seedance_480p');
    expect(resolveSeedancePricingTaskType({ resolution: '720p' }, 'seedance-fast')).toBe('seedance_fast_720p');
    expect(resolveSeedancePricingTaskType({ resolution: '720p' }, 'seedance-pro')).toBe('seedance_720p');
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
      model: 'seedance-fast',
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

  it('summarizes Seedance content and builds cost estimate input', () => {
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
    expect(
      buildSeedanceCostEstimateInput({
        params: { resolution: '1080P', duration: 5.2 },
        model: 'seedance-pro',
        content,
      }),
    ).toEqual({
      taskType: 'seedance_1080p',
      modelName: 'seedance-pro',
      resolution: '1080p',
      seconds: 6,
      referenceImages: 2,
      hasVideoInput: true,
      hasAudioInput: true,
    });
  });

  it('builds video hold input with preserved metadata and remark shape', () => {
    expect(
      buildVideoHoldInput({
        billingTaskType: 'seedance_720p',
        generationId: 'gen-1',
        estimatedCost: 1600,
        pricingSnapshot: { ruleId: 'rule-video', drop: undefined },
        refundPolicy: { systemFailed: 'full_refund' },
        projectId: 'project-1',
        clipId: 'clip-1',
        modelConfigId: 'model-config-1',
        taskRequest: {
          model: 'seedance-pro',
          content: [{ type: 'text', text: 'prompt' }],
          duration: 5,
        },
      }),
    ).toEqual({
      taskType: 'seedance_720p',
      taskId: 'gen-1',
      amount: 1600,
      pricingSnapshot: { ruleId: 'rule-video' },
      refundPolicySnapshot: { systemFailed: 'full_refund' },
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
      remark: 'video-generation:seedance_720p',
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
    expect(
      presentGenerateAllClipResults([
        { generationId: 123, taskId: 'task-1', clipId: 'clip-1' },
        null,
      ]),
    ).toEqual([{ generationId: '123', taskId: 'task-1', clipId: 'clip-1' }]);
  });
});
