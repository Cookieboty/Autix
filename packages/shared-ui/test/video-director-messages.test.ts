import { describe, expect, test } from 'bun:test';
import {
  buildStoryboardGenerationMessage,
  buildStoryboardGenerationSharedParams,
  buildStoryboardPromptOptimizationMessage,
  buildVideoPromptOptimizationMessage,
  resolveStoryboardToolClipCount,
} from '../src/video/workbench/director-messages';
import type { VideoClip } from '@autix/shared-store';

const clip: VideoClip = {
  id: 'clip-1',
  projectId: 'project-1',
  order: 2,
  title: 'Close-up',
  prompt: 'old prompt',
  params: {
    duration: 8,
    ratio: '9:16',
    startTime: 1,
    endTime: 3,
    storyboardPrompt: 'existing storyboard',
  },
  chainFromPrev: true,
  status: 'ready',
  materials: [],
  generations: [],
};

describe('video director messages', () => {
  test('builds storyboard prompt optimization message with the same response shape', () => {
    const message = buildStoryboardPromptOptimizationMessage({
      clip,
      title: 'Close-up',
      params: { generationMode: 'storyboard', duration: 5 },
      prompt: 'make it cinematic',
    });

    expect(message).toContain('请优化分镜模式的整片提示词。');
    expect(message).toContain('"action":"update_params"');
    expect(message).toContain('"clipOrder":2');
    expect(message).toContain('"storyboardPrompt":"优化后的整片视频提示词"');
    expect(message).toContain('原始整片提示词：make it cinematic');
  });

  test('builds single clip prompt optimization message', () => {
    const message = buildVideoPromptOptimizationMessage({
      clip,
      title: 'Close-up',
      params: { generationMode: 'standard', duration: 6 },
      prompt: 'walk forward',
    });

    expect(message).toContain('请优化第 2 个视频片段的提示词。');
    expect(message).toContain('"action":"update_prompt"');
    expect(message).toContain('"prompt":"优化后的完整视频提示词"');
    expect(message).toContain('原始提示词：walk forward');
  });

  test('sanitizes storyboard generation shared params without changing inheritance order', () => {
    const params = buildStoryboardGenerationSharedParams({
      globalVideoParams: {
        duration: 5,
        ratio: '16:9',
        resolution: '1080p',
        start: 0,
      },
      selectedClip: clip,
      storyboardPrompt: '  new storyboard  ',
    });

    expect(params).toEqual({
      ratio: '9:16',
      resolution: '1080p',
      generateAudio: true,
      generationMode: 'storyboard',
      storyboardPrompt: '  new storyboard  ',
    });
  });

  test('builds storyboard generation message and normalizes unsupported clip counts', () => {
    expect(resolveStoryboardToolClipCount(4)).toBe(5);
    expect(resolveStoryboardToolClipCount(6)).toBe(6);

    const message = buildStoryboardGenerationMessage({
      prompt: 'launch a product',
      targetCount: 3,
      suggestedClipDuration: 5,
      suggestedTotalDuration: 15,
      sharedParams: { resolution: '1080p', ratio: '16:9' },
    });

    expect(message).toContain('严格拆成 3 个连续分镜脚本');
    expect(message).toContain('clipOrder 必须从 1 到 3 连续编号');
    expect(message).toContain('总时长必须 ≤ 15 秒');
    expect(message).toContain('"resolution":"1080p"');
    expect(message).toContain('视频创意 / Prompt：launch a product');
  });
});
