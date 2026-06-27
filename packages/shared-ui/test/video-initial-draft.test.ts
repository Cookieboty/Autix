import { describe, expect, test } from 'bun:test';
import { buildVideoInitialDraftParams } from '../src/video/workbench/initial-draft';

describe('buildVideoInitialDraftParams', () => {
  test('copies public-generator params into clip params', () => {
    expect(
      buildVideoInitialDraftParams(
        {
          duration: 10,
          resolution: '1080p',
          ratio: '9:16',
          generateAudio: false,
          prompt: 'A crisp product reveal',
        },
        'standard',
      ),
    ).toEqual({
      duration: 10,
      resolution: '1080p',
      ratio: '9:16',
      generateAudio: false,
      generationMode: 'standard',
    });
  });

  test('stores storyboard prompt when the draft opens storyboard mode', () => {
    expect(
      buildVideoInitialDraftParams(
        {
          duration: 15,
          prompt: 'Three cinematic beats',
        },
        'storyboard',
      ),
    ).toEqual({
      duration: 15,
      generationMode: 'storyboard',
      storyboardPrompt: 'Three cinematic beats',
    });
  });
});
