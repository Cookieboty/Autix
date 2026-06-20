import { describe, expect, test } from 'bun:test';
import {
  extractStoryboardPromptFromDirectorContent,
  resolveLatestCompletedVideoGeneration,
} from '../src/video/workbench/constants';
import type { VideoClip } from '@autix/shared-store';

describe('video workbench constants', () => {
  test('extracts storyboard prompt from director params payload', () => {
    expect(
      extractStoryboardPromptFromDirectorContent(
        '已生成分镜\n参数：{"storyboardPrompt":"launch scene","clipCount":5}',
      ),
    ).toBe('launch scene');
  });

  test('ignores missing or empty storyboard params', () => {
    expect(extractStoryboardPromptFromDirectorContent(null)).toBeNull();
    expect(extractStoryboardPromptFromDirectorContent('参数：{"storyboardPrompt":"   "}')).toBeNull();
    expect(extractStoryboardPromptFromDirectorContent('no params here')).toBeNull();
  });

  test('ignores invalid director params json', () => {
    expect(extractStoryboardPromptFromDirectorContent('参数：{"storyboardPrompt":')).toBeNull();
  });

  test('resolves the newest completed generation with a video url', () => {
    const clip: VideoClip = {
      id: 'clip-1',
      projectId: 'project-1',
      order: 1,
      title: 'Clip',
      prompt: 'Prompt',
      params: {},
      chainFromPrev: false,
      status: 'ready',
      materials: [],
      generations: [
        {
          id: 'failed',
          clipId: 'clip-1',
          projectId: 'project-1',
          userId: 'user-1',
          model: 'model',
          resolvedPrompt: 'old',
          params: {},
          status: 'failed',
          videoUrl: 'https://cdn.example.com/failed.mp4',
          createdAt: '2026-01-03T00:00:00.000Z',
        },
        {
          id: 'old',
          clipId: 'clip-1',
          projectId: 'project-1',
          userId: 'user-1',
          model: 'model',
          resolvedPrompt: 'old',
          params: {},
          status: 'completed',
          videoUrl: 'https://cdn.example.com/old.mp4',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'new',
          clipId: 'clip-1',
          projectId: 'project-1',
          userId: 'user-1',
          model: 'model',
          resolvedPrompt: 'new',
          params: {},
          status: 'completed',
          videoUrl: 'https://cdn.example.com/new.mp4',
          createdAt: '2026-01-02T00:00:00.000Z',
        },
      ],
    };

    expect(resolveLatestCompletedVideoGeneration(clip)?.id).toBe('new');
    expect(resolveLatestCompletedVideoGeneration(null)).toBeNull();
  });
});
