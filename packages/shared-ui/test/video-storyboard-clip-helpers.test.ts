import type { VideoClip } from '@autix/shared-store';
import {
  buildStoryboardClipParams,
  resolveNextStoryboardClipDuration,
} from '../src/video/workbench/storyboard-clip-helpers';

function makeClip(id: string, duration: number): VideoClip {
  return {
    id,
    projectId: 'project-1',
    order: Number(id.replace('clip-', '')),
    title: id,
    prompt: '',
    params: { duration },
    chainFromPrev: false,
    status: 'ready',
    materials: [],
    generations: [],
  };
}

describe('storyboard clip helpers', () => {
  test('caps the next clip duration to the remaining storyboard timeline budget', () => {
    expect(resolveNextStoryboardClipDuration([
      makeClip('clip-1', 8),
      makeClip('clip-2', 5),
    ], 6)).toBe(2);
  });

  test('uses the storyboard max duration when requested duration is not finite', () => {
    expect(resolveNextStoryboardClipDuration([], Number.NaN)).toBe(15);
  });

  test('builds storyboard clip params without legacy timing bounds', () => {
    expect(buildStoryboardClipParams({
      duration: 4,
      globalVideoParams: {
        ratio: '9:16',
        resolution: '720p',
        startTime: 1,
        endTime: 3,
        start: 0,
        end: 6,
      },
      storyboardPrompt: '  product launch  ',
    })).toEqual({
      duration: 4,
      ratio: '9:16',
      resolution: '720p',
      generateAudio: true,
      generationMode: 'storyboard',
      storyboardPrompt: '  product launch  ',
    });
  });

  test('omits blank storyboard prompt params', () => {
    expect(buildStoryboardClipParams({
      duration: 3,
      globalVideoParams: {},
      storyboardPrompt: '   ',
    })).not.toHaveProperty('storyboardPrompt');
  });
});
