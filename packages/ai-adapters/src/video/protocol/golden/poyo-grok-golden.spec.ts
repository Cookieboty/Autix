import { describe, it, expect } from 'vitest';
import { assembleVideoRequest } from '../assemble';
import { poyoGrokImagine, poyoGrokV15 } from '../presets/vendors';
import type { VideoCallRequest, VideoMaterialInput, VideoProtocolPreset } from '../types';

const assemble = (
  preset: VideoProtocolPreset,
  model: string,
  materials: VideoMaterialInput[],
  params: Record<string, unknown>,
) =>
  assembleVideoRequest({
    preset,
    baseUrl: 'https://api.poyo.ai',
    apiKey: 'k',
    model,
    prompt: 'a scene',
    materials,
    params,
  } as VideoCallRequest);

describe('golden: poyoGrok request shapes', () => {
  it('grok-imagine t2v: prompt + aspect_ratio + duration, no image_urls', () => {
    expect(assemble(poyoGrokImagine, 'grok-imagine', [], { ratio: '16:9', duration: 6 })).toEqual({
      model: 'grok-imagine',
      input: { prompt: 'a scene', aspect_ratio: '16:9', duration: 6 },
    });
  });

  it('grok-imagine i2v: material → image_urls', () => {
    expect(
      assemble(poyoGrokImagine, 'grok-imagine', [{ role: 'first_frame', url: 'https://x/a.jpg' }], {
        ratio: '9:16',
        duration: 10,
      }),
    ).toEqual({
      model: 'grok-imagine',
      input: { prompt: 'a scene', image_urls: ['https://x/a.jpg'], aspect_ratio: '9:16', duration: 10 },
    });
  });

  it('grok-imagine-video-1.5: resolution + duration + image_urls; NO aspect_ratio even if ratio passed', () => {
    expect(
      assemble(poyoGrokV15, 'grok-imagine-video-1.5', [{ role: 'first_frame', url: 'https://x/src.png' }], {
        resolution: '720p',
        duration: 6,
        ratio: '16:9',
      }),
    ).toEqual({
      model: 'grok-imagine-video-1.5',
      input: { prompt: 'a scene', image_urls: ['https://x/src.png'], resolution: '720p', duration: 6 },
    });
  });
});
