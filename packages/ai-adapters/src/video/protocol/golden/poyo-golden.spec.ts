import { describe, it, expect } from 'vitest';
import { assembleVideoRequest } from '../assemble';
import { poyoVeo } from '../presets/vendors';
import { normalizeVideoOutcome } from '../result';
import type { VideoCallRequest, VideoMaterialInput } from '../types';
import fixtures from './poyo-request.fixtures.json';

type Fixture = {
  name: string;
  input: {
    model: string;
    prompt: string | null;
    materials: VideoMaterialInput[];
    params: Record<string, unknown>;
    callbackUrl?: string;
  };
  expected: Record<string, unknown>;
};

/**
 * Golden：poyoVeo preset 产出的请求体是「PoYo /api/generate/submit 请求形态」的唯一可执行规格。
 * 锁死 flat-media 布局（input.prompt 字符串 + input.image_urls 纯 URL 数组）与 input.* 参数映射。
 * 断言用深度相等（key 顺序对 JSON HTTP 非行为差异）。
 */
describe('golden: poyoVeo request shape', () => {
  for (const fixture of fixtures as Fixture[]) {
    it(fixture.name, () => {
      const req: VideoCallRequest = {
        preset: poyoVeo,
        baseUrl: 'https://api.poyo.ai',
        apiKey: 'k',
        model: fixture.input.model,
        prompt: fixture.input.prompt,
        materials: fixture.input.materials,
        params: fixture.input.params,
        callbackUrl: fixture.input.callbackUrl,
      };
      expect(assembleVideoRequest(req)).toEqual(fixture.expected);
    });
  }

  it('never injects callback_url (v1 is poll-only, no webhook)', () => {
    const body = assembleVideoRequest({
      preset: poyoVeo,
      baseUrl: 'https://api.poyo.ai',
      apiKey: 'k',
      model: 'veo3.1-fast-official',
      prompt: 'x',
      materials: [],
      params: { duration: 4 },
      callbackUrl: 'https://our-callback/poyo?token=abc',
    });
    expect(body).not.toHaveProperty('callback_url');
  });
});

/**
 * Golden：PoYo 状态响应 → 内部终态。锁死 data.status 字典、成功件的 data.files[0].file_url、
 * 失败件的 data.error_message。
 */
describe('golden: poyoVeo result normalization', () => {
  it('maps finished → succeeded and reads data.files[0].file_url', () => {
    const outcome = normalizeVideoOutcome(poyoVeo.result, {
      code: 200,
      data: {
        task_id: 't1',
        status: 'finished',
        files: [{ file_url: 'https://storage.poyo.ai/v.mp4', file_type: 'video' }],
        error_message: null,
      },
    });
    expect(outcome).toMatchObject({ kind: 'succeeded', sourceUrl: 'https://storage.poyo.ai/v.mp4' });
  });

  it('maps running / not_started → active', () => {
    expect(normalizeVideoOutcome(poyoVeo.result, { data: { status: 'running' } })).toMatchObject({ kind: 'active' });
    expect(normalizeVideoOutcome(poyoVeo.result, { data: { status: 'not_started' } })).toMatchObject({ kind: 'active' });
  });

  it('maps failed → failed and reads data.error_message', () => {
    const outcome = normalizeVideoOutcome(poyoVeo.result, {
      data: { status: 'failed', error_message: 'content policy violation' },
    });
    expect(outcome).toEqual({ kind: 'failed', externalStatus: 'failed', error: 'content policy violation' });
  });
});
