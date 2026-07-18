import { describe, it, expect } from 'vitest';
import { assembleVideoRequest } from '../assemble';
import { poyoWanT2V, poyoWanI2V, poyoWanRef, poyoWanEdit } from '../presets/vendors';
import type { VideoCallRequest, VideoMaterialInput, VideoProtocolPreset } from '../types';

const assemble = (
  preset: VideoProtocolPreset,
  model: string,
  prompt: string | null,
  materials: VideoMaterialInput[],
  params: Record<string, unknown>,
) =>
  assembleVideoRequest({
    preset,
    baseUrl: 'https://api.poyo.ai',
    apiKey: 'k',
    model,
    prompt,
    materials,
    params,
  } as VideoCallRequest);

/**
 * Golden：PoYo Wan 2.7 四个模型的请求体形态。锁死 flat-media 的**按 role 路由**：
 * i2v→image_urls、ref→reference_image_urls/reference_video_urls、edit→单个 video_url/reference_image_url，
 * 以及 i2v 无 aspect_ratio、edit duration:0 必发、seed -1 省略。
 */
describe('golden: poyoWan request shapes', () => {
  it('t2v: prompt + aspect_ratio/resolution/duration/seed into input.*', () => {
    expect(
      assemble(poyoWanT2V, 'wan2.7-text-to-video', 'greenhouse at sunrise', [], {
        resolution: '720p',
        duration: 5,
        ratio: '16:9',
        seed: 42,
      }),
    ).toEqual({
      model: 'wan2.7-text-to-video',
      input: { prompt: 'greenhouse at sunrise', resolution: '720p', duration: 5, aspect_ratio: '16:9', seed: 42 },
    });
  });

  it('i2v: first/last frame → image_urls in order; NO aspect_ratio even if params carry ratio', () => {
    expect(
      assemble(
        poyoWanI2V,
        'wan2.7-image-to-video',
        'animate',
        [
          { role: 'first_frame', url: 'https://x/start.png' },
          { role: 'last_frame', url: 'https://x/end.png' },
        ],
        { resolution: '1080p', duration: 5, ratio: '16:9' },
      ),
    ).toEqual({
      model: 'wan2.7-image-to-video',
      input: {
        prompt: 'animate',
        image_urls: ['https://x/start.png', 'https://x/end.png'],
        resolution: '1080p',
        duration: 5,
      },
    });
  });

  it('ref: reference_image → reference_image_urls, reference_video → reference_video_urls', () => {
    expect(
      assemble(
        poyoWanRef,
        'wan2.7-reference-to-video',
        'product reveal',
        [
          { role: 'reference_image', url: 'https://x/ref.png' },
          { role: 'reference_video', url: 'https://x/ref.mp4' },
        ],
        { resolution: '720p', duration: 5, ratio: '1:1' },
      ),
    ).toEqual({
      model: 'wan2.7-reference-to-video',
      input: {
        prompt: 'product reveal',
        reference_image_urls: ['https://x/ref.png'],
        reference_video_urls: ['https://x/ref.mp4'],
        resolution: '720p',
        duration: 5,
        aspect_ratio: '1:1',
      },
    });
  });

  it('edit: source video (reference_video) → single video_url; reference_image → single reference_image_url; duration:0 is sent', () => {
    expect(
      assemble(
        poyoWanEdit,
        'wan2.7-edit-video',
        'rainy neon street',
        [
          { role: 'reference_video', url: 'https://x/source.mp4' },
          { role: 'reference_image', url: 'https://x/style.png' },
        ],
        { resolution: '720p', duration: 0, ratio: '16:9' },
      ),
    ).toEqual({
      model: 'wan2.7-edit-video',
      input: {
        prompt: 'rainy neon street',
        video_url: 'https://x/source.mp4',
        reference_image_url: 'https://x/style.png',
        resolution: '720p',
        duration: 0,
        aspect_ratio: '16:9',
      },
    });
  });

  it('omits seed -1 (unified random sentinel) — Wan seed is 0..2147483647', () => {
    const body = assemble(poyoWanT2V, 'wan2.7-text-to-video', 'x', [], {
      resolution: '720p',
      duration: 5,
      seed: -1,
    });
    expect((body.input as Record<string, unknown>)).not.toHaveProperty('seed');
  });
});
