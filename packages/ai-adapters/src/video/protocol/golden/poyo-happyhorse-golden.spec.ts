import { describe, it, expect } from 'vitest';
import { assembleVideoRequest } from '../assemble';
import { poyoHappyHorse, poyoHappyHorse11 } from '../presets/vendors';
import type { VideoCallRequest, VideoMaterialInput, VideoProtocolPreset } from '../types';

const asm = (preset: VideoProtocolPreset, model: string, materials: VideoMaterialInput[], params: Record<string, unknown>, prompt: string | null = 'a scene') =>
  assembleVideoRequest({ preset, baseUrl: 'https://api.poyo.ai', apiKey: 'k', model, prompt, materials, params } as VideoCallRequest);

describe('golden: poyoHappyHorse request shapes', () => {
  it('t2v: prompt + aspect_ratio/resolution/duration', () => {
    expect(asm(poyoHappyHorse, 'happy-horse', [], { ratio: '16:9', resolution: '1080p', duration: 5 })).toEqual({
      model: 'happy-horse',
      input: { prompt: 'a scene', aspect_ratio: '16:9', resolution: '1080p', duration: 5 },
    });
  });
  it('i2v: first_frame → image_urls', () => {
    expect(asm(poyoHappyHorse, 'happy-horse', [{ role: 'first_frame', url: 'https://x/a.png' }], { resolution: '720p', duration: 5, ratio: '16:9' })).toEqual({
      model: 'happy-horse',
      input: { prompt: 'a scene', image_urls: ['https://x/a.png'], aspect_ratio: '16:9', resolution: '720p', duration: 5 },
    });
  });
  it('ref: reference_image → reference_image_urls (multi, order preserved)', () => {
    expect(asm(poyoHappyHorse, 'happy-horse', [
      { role: 'reference_image', url: 'https://x/c1.png' },
      { role: 'reference_image', url: 'https://x/c2.png' },
    ], { ratio: '16:9', resolution: '1080p', duration: 10 })).toEqual({
      model: 'happy-horse',
      input: { prompt: 'a scene', reference_image_urls: ['https://x/c1.png', 'https://x/c2.png'], aspect_ratio: '16:9', resolution: '1080p', duration: 10 },
    });
  });
  it('happy-horse-1.1 same routing, own model id', () => {
    expect(asm(poyoHappyHorse11, 'happy-horse-1.1', [{ role: 'first_frame', url: 'https://x/f.png' }], { resolution: '1080p', duration: 10 }, 'sing')).toEqual({
      model: 'happy-horse-1.1',
      input: { prompt: 'sing', image_urls: ['https://x/f.png'], resolution: '1080p', duration: 10 },
    });
  });
});
