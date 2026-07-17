import { describe, it, expect } from 'vitest';
import { assembleVideoRequest } from './assemble';
import { arkVideoV3 } from './presets/vendors';
import type { VideoCallRequest } from './types';

const base = (over: Partial<VideoCallRequest> = {}): VideoCallRequest => ({
  preset: arkVideoV3,
  baseUrl: 'https://api.example.com',
  apiKey: 'k',
  model: 'doubao-seedance-2.0-fast',
  prompt: 'a cat',
  materials: [],
  params: {},
  ...over,
});

describe('assembleVideoRequest — content', () => {
  it('emits the prompt as a text item', () => {
    expect(assembleVideoRequest(base()).content).toEqual([{ type: 'text', text: 'a cat' }]);
  });

  // 对齐 buildContent 的 `if (prompt)`：空 prompt 不写 text item。
  it('omits the text item when the prompt is empty', () => {
    expect(assembleVideoRequest(base({ prompt: '' })).content).toEqual([]);
    expect(assembleVideoRequest(base({ prompt: null })).content).toEqual([]);
  });

  // role 决定 item 形态：三个图片角色走 image_url，video/audio 各走自己的字段。
  it('maps every material role to its wire item shape', () => {
    const body = assembleVideoRequest(
      base({
        prompt: 'p',
        materials: [
          { role: 'first_frame', url: 'https://x/1.jpg' },
          { role: 'last_frame', url: 'https://x/2.jpg' },
          { role: 'reference_image', url: 'https://x/3.jpg' },
          { role: 'reference_video', url: 'https://x/4.mp4' },
          { role: 'reference_audio', url: 'https://x/5.mp3' },
        ],
      }),
    );
    expect(body.content).toEqual([
      { type: 'text', text: 'p' },
      { type: 'image_url', image_url: { url: 'https://x/1.jpg' }, role: 'first_frame' },
      { type: 'image_url', image_url: { url: 'https://x/2.jpg' }, role: 'last_frame' },
      { type: 'image_url', image_url: { url: 'https://x/3.jpg' }, role: 'reference_image' },
      { type: 'video_url', video_url: { url: 'https://x/4.mp4' }, role: 'reference_video' },
      { type: 'audio_url', audio_url: { url: 'https://x/5.mp3' }, role: 'reference_audio' },
    ]);
  });
});

describe('assembleVideoRequest — 省略语义（四种，逐条复刻 buildTaskRequest）', () => {
  // omitWhen: 'undefined' —— false 必须发出去
  it('sends generateAudio: false (undefined-omit, not falsy-omit)', () => {
    const body = assembleVideoRequest(base({ params: { generateAudio: false } }));
    expect(body.generate_audio).toBe(false);
    expect('generate_audio' in body).toBe(true);
  });

  // omitWhen: 'undefined' —— 0 必须发出去
  it('sends seconds: 0 (undefined-omit, not falsy-omit)', () => {
    const body = assembleVideoRequest(base({ params: { seconds: 0 } }));
    expect(body.duration).toBe(0);
  });

  // omitWhen: 'falsy' —— false 必须省略
  it('omits watermark: false (falsy-omit)', () => {
    expect('watermark' in assembleVideoRequest(base({ params: { watermark: false } }))).toBe(false);
    expect(assembleVideoRequest(base({ params: { watermark: true } })).watermark).toBe(true);
  });

  it('omits returnLastFrame: false (falsy-omit)', () => {
    const off = assembleVideoRequest(base({ params: { returnLastFrame: false } }));
    expect('return_last_frame' in off).toBe(false);
    expect(assembleVideoRequest(base({ params: { returnLastFrame: true } })).return_last_frame).toBe(true);
  });

  // omitValues: [-1] —— 哨兵值必须省略，其余 seed 照发
  it('omits the -1 seed sentinel but sends real seeds', () => {
    expect('seed' in assembleVideoRequest(base({ params: { seed: -1 } }))).toBe(false);
    expect(assembleVideoRequest(base({ params: { seed: 42 } })).seed).toBe(42);
    expect(assembleVideoRequest(base({ params: { seed: 0 } })).seed).toBe(0);
  });

  // omitWhen: 'falsy' —— 空串省略
  it('omits empty resolution / ratio (falsy-omit)', () => {
    const body = assembleVideoRequest(base({ params: { resolution: '', ratio: '' } }));
    expect('resolution' in body).toBe(false);
    expect('ratio' in body).toBe(false);
  });

  it('omits every unset param', () => {
    expect(assembleVideoRequest(base())).toEqual({
      model: 'doubao-seedance-2.0-fast',
      content: [{ type: 'text', text: 'a cat' }],
    });
  });
});

describe('assembleVideoRequest — callbackUrl', () => {
  it('injects the callback url when given', () => {
    const body = assembleVideoRequest(base({ callbackUrl: 'https://app/cb?token=s' }));
    expect(body.callback_url).toBe('https://app/cb?token=s');
  });

  // webhook 能力缺省或未给地址 → 不注入，纯靠轮询收敛。
  it('omits callback_url when not given', () => {
    expect('callback_url' in assembleVideoRequest(base())).toBe(false);
  });
});
