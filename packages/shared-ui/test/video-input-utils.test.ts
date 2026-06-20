import { describe, expect, test } from 'bun:test';
import {
  createEmptyVideoFrame,
  createVideoMaterialFromFile,
  createVideoFramesFromImages,
  createVideoTemplateMaterials,
  DEFAULT_VIDEO_FRAME_DURATION,
  inferVideoMaterialType,
  placeVideoMaterialInFrames,
  swapFirstLastVideoFrames,
} from '../src/video/video-input-utils';
import type { VideoMaterial } from '../src/video/VideoInputArea';

describe('video input utils', () => {
  test('infers video material type from urls before query strings', () => {
    expect(inferVideoMaterialType('https://cdn.example.com/clip.MP4?token=1')).toBe('video');
    expect(inferVideoMaterialType('https://cdn.example.com/audio.m4a?token=1')).toBe('audio');
    expect(inferVideoMaterialType('https://cdn.example.com/image')).toBe('image');
  });

  test('creates template materials with indexed names and inferred media types', () => {
    const materials = createVideoTemplateMaterials([
      'https://cdn.example.com/one.png',
      'https://cdn.example.com/two.mp4',
    ]);

    expect(materials).toHaveLength(2);
    expect(materials[0]).toMatchObject({
      url: 'https://cdn.example.com/one.png',
      name: 'template-1',
      type: 'image',
    });
    expect(materials[0]?.id).toStartWith('tpl-mat-');
    expect(materials[0]?.id).toEndWith('-0');
    expect(materials[1]).toMatchObject({
      url: 'https://cdn.example.com/two.mp4',
      name: 'template-2',
      type: 'video',
    });
    expect(materials[1]?.id).toStartWith('tpl-mat-');
    expect(materials[1]?.id).toEndWith('-1');
  });

  test('creates two slots for first/last frame mode and ignores non-images', () => {
    const materials: VideoMaterial[] = [
      { id: 'image-1', url: 'https://cdn.example.com/one.png', type: 'image' },
      { id: 'video-1', url: 'https://cdn.example.com/two.mp4', type: 'video' },
      { id: 'image-2', url: 'https://cdn.example.com/three.png', type: 'image' },
      { id: 'image-3', url: 'https://cdn.example.com/four.png', type: 'image' },
    ];

    const frames = createVideoFramesFromImages(materials, 'first_last_frame', 7);

    expect(frames).toHaveLength(2);
    expect(frames[0]).toMatchObject({ material: materials[0], duration: 7 });
    expect(frames[0]?.id).toStartWith('frame-');
    expect(frames[0]?.id).toEndWith('-0');
    expect(frames[1]).toMatchObject({ material: materials[2], duration: 7 });
    expect(frames[1]?.id).toStartWith('frame-');
    expect(frames[1]?.id).toEndWith('-1');
  });

  test('pads empty first/last and smart multiframe modes with placeholder frames', () => {
    const firstLastFrames = createVideoFramesFromImages([], 'first_last_frame');
    const smartFrames = createVideoFramesFromImages([], 'smart_multiframe', 6);

    expect(firstLastFrames).toHaveLength(2);
    expect(firstLastFrames[0]).toMatchObject({
      material: null,
      duration: DEFAULT_VIDEO_FRAME_DURATION,
    });
    expect(firstLastFrames[0]?.id).toStartWith('frame-');
    expect(firstLastFrames[0]?.id).toEndWith('-0');
    expect(firstLastFrames[1]).toMatchObject({
      material: null,
      duration: DEFAULT_VIDEO_FRAME_DURATION,
    });
    expect(firstLastFrames[1]?.id).toStartWith('frame-');
    expect(firstLastFrames[1]?.id).toEndWith('-1');
    expect(smartFrames).toHaveLength(1);
    expect(smartFrames[0]).toMatchObject({ material: null, duration: 6 });
    expect(smartFrames[0]?.id).toStartWith('frame-');
    expect(smartFrames[0]?.id).toEndWith('-0');
  });

  test('creates file-backed materials with audio optionally disabled', () => {
    const audioFile = new File(['audio'], 'voice.mp3', { type: 'audio/mpeg' });
    const audioMaterial = createVideoMaterialFromFile(audioFile, 'data:audio', {
      allowAudio: true,
      idSuffix: '-audio',
    });
    const frameMaterial = createVideoMaterialFromFile(audioFile, 'data:audio', {
      allowAudio: false,
      idSuffix: '-frame',
    });

    expect(audioMaterial).toMatchObject({
      url: 'data:audio',
      name: 'voice.mp3',
      type: 'audio',
    });
    expect(audioMaterial.id).toEndWith('-audio');
    expect(frameMaterial).toMatchObject({
      url: 'data:audio',
      name: 'voice.mp3',
      type: 'image',
    });
    expect(frameMaterial.id).toEndWith('-frame');
  });

  test('swaps first and last frame materials while preserving extra frames', () => {
    const first = { id: 'image-1', url: 'one', type: 'image' as const };
    const last = { id: 'image-2', url: 'two', type: 'image' as const };
    const extra = { id: 'image-3', url: 'three', type: 'image' as const };

    expect(
      swapFirstLastVideoFrames([
        { id: 'frame-1', material: first, duration: 5 },
        { id: 'frame-2', material: last, duration: 6 },
        { id: 'frame-3', material: extra, duration: 7 },
      ]),
    ).toEqual([
      { id: 'frame-1', material: last, duration: 5 },
      { id: 'frame-2', material: first, duration: 6 },
      { id: 'frame-3', material: extra, duration: 7 },
    ]);
  });

  test('places pasted materials into empty frames first', () => {
    const material = { id: 'image-1', url: 'one', type: 'image' as const };

    expect(
      placeVideoMaterialInFrames(
        [
          createEmptyVideoFrame('frame-1'),
          createEmptyVideoFrame('frame-2'),
        ],
        material,
        'first_last_frame',
      ),
    ).toEqual([
      { id: 'frame-1', material, duration: DEFAULT_VIDEO_FRAME_DURATION },
      { id: 'frame-2', material: null, duration: DEFAULT_VIDEO_FRAME_DURATION },
    ]);
  });

  test('preserves ChatView and Dock first/last full-frame paste behaviors', () => {
    const oldMaterial = { id: 'old', url: 'old', type: 'image' as const };
    const newMaterial = { id: 'new', url: 'new', type: 'image' as const };
    const fullFrames = [
      { id: 'frame-1', material: oldMaterial, duration: 5 },
      { id: 'frame-2', material: oldMaterial, duration: 5 },
    ];

    expect(
      placeVideoMaterialInFrames(fullFrames, newMaterial, 'first_last_frame', {
        appendWhenFull: false,
      }),
    ).toEqual([
      { id: 'frame-1', material: newMaterial, duration: 5 },
      { id: 'frame-2', material: oldMaterial, duration: 5 },
    ]);

    const appended = placeVideoMaterialInFrames(fullFrames, newMaterial, 'first_last_frame', {
      appendWhenFull: true,
      frameIdSuffix: '-1',
    });
    expect(appended).toHaveLength(3);
    expect(appended[2]).toMatchObject({
      material: newMaterial,
      duration: DEFAULT_VIDEO_FRAME_DURATION,
    });
    expect(appended[2]?.id).toStartWith('frame-');
    expect(appended[2]?.id).toEndWith('-1');
  });
});
