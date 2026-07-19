import { describe, it, expect, vi, afterEach } from 'vitest';
import { submitVideoTask, queryVideoTask, videoSubmitUrl, videoQueryUrl } from './submit';
import { arkVideoV3 } from './presets/vendors';
import { setSafeFetchResolver } from '../../core/safe-fetch';
import { VideoUpstreamError } from './types';

const stubPublicDns = () =>
  setSafeFetchResolver(async () => [{ address: '93.184.216.34', family: 4 }]);

const args = {
  preset: arkVideoV3,
  baseUrl: 'https://api.example.com',
  apiKey: 'secret-key',
  model: 'doubao-seedance-2.0-fast',
  prompt: 'a cat',
  materials: [],
  params: {},
};

describe('submitVideoTask', () => {
  afterEach(() => {
    setSafeFetchResolver(null);
    vi.unstubAllGlobals();
  });

  it('posts to the preset endpoint with the preset auth header', async () => {
    stubPublicDns();
    let seen: { url?: string; init?: RequestInit } = {};
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response(JSON.stringify({ id: 'task_1' }), { status: 200 });
    });

    const { providerTaskId } = await submitVideoTask(args);

    expect(providerTaskId).toBe('task_1');
    expect(seen.url).toBe('https://api.example.com/api/v3/contents/generations/tasks');
    expect(seen.init?.method).toBe('POST');
    expect((seen.init?.headers as Record<string, string>).Authorization).toBe('Bearer secret-key');
  });

  // taskIdPath 是候选链 ['id', 'task_id']：只给后备字段时回落到它。
  it('falls back through the taskId candidate chain', async () => {
    stubPublicDns();
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ task_id: 'task_2' }), { status: 200 }));
    expect((await submitVideoTask(args)).providerTaskId).toBe('task_2');
  });

  // 两个字段都在时必须取 id —— 只测单字段的话候选链顺序反过来也照样绿。
  it('prefers id over task_id when the response carries both', async () => {
    stubPublicDns();
    vi.stubGlobal('fetch', async () => new Response(
      JSON.stringify({ id: 'from-id', task_id: 'from-task-id' }),
      { status: 200 },
    ));
    expect((await submitVideoTask(args)).providerTaskId).toBe('from-id');
  });

  it('classifies upstream errors via the preset errorMapping', async () => {
    stubPublicDns();
    vi.stubGlobal('fetch', async () => new Response('bad params', { status: 400 }));
    await expect(submitVideoTask(args)).rejects.toThrow(VideoUpstreamError);
    await expect(submitVideoTask(args)).rejects.toMatchObject({ classification: 'params', retryable: false });
  });

  it('marks 429 as retryable rate-limit', async () => {
    stubPublicDns();
    vi.stubGlobal('fetch', async () => new Response('slow down', { status: 429 }));
    await expect(submitVideoTask(args)).rejects.toMatchObject({ classification: 'rate-limit', retryable: true });
  });

  it('throws when the response carries no task id', async () => {
    stubPublicDns();
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({}), { status: 200 }));
    await expect(submitVideoTask(args)).rejects.toThrow(/task id/i);
  });
});

describe('queryVideoTask', () => {
  afterEach(() => {
    setSafeFetchResolver(null);
    vi.unstubAllGlobals();
  });

  it('injects the taskId into the query endpoint and normalizes the outcome', async () => {
    stubPublicDns();
    let seenUrl = '';
    vi.stubGlobal('fetch', async (url: string) => {
      seenUrl = url;
      return new Response(JSON.stringify({ status: 'succeeded', video_url: 'https://x/v.mp4' }), { status: 200 });
    });

    const outcome = await queryVideoTask({
      preset: arkVideoV3,
      baseUrl: 'https://api.example.com',
      apiKey: 'k',
      taskId: 'task_9',
    });

    expect(seenUrl).toBe('https://api.example.com/api/v3/contents/generations/tasks/task_9');
    expect(outcome).toMatchObject({ kind: 'succeeded', sourceUrl: 'https://x/v.mp4' });
  });
});

// 上层日志用这两个纯函数记录「打到哪个上游接口」，必须与 submit/query 实际发请求
// 的 URL 逐字节一致（上面两条 fetch 断言即真相），故这里锁死同样的构造语义。
describe('videoSubmitUrl / videoQueryUrl', () => {
  it('builds the submit URL and strips a trailing slash on the baseUrl', () => {
    expect(videoSubmitUrl(arkVideoV3, 'https://api.example.com')).toBe(
      'https://api.example.com/api/v3/contents/generations/tasks',
    );
    expect(videoSubmitUrl(arkVideoV3, 'https://api.example.com/')).toBe(
      'https://api.example.com/api/v3/contents/generations/tasks',
    );
  });

  it('builds the query URL with the taskId url-encoded', () => {
    expect(videoQueryUrl(arkVideoV3, 'https://api.example.com', 'task_9')).toBe(
      'https://api.example.com/api/v3/contents/generations/tasks/task_9',
    );
    expect(videoQueryUrl(arkVideoV3, 'https://api.example.com', 'a/b?c')).toBe(
      'https://api.example.com/api/v3/contents/generations/tasks/a%2Fb%3Fc',
    );
  });
});
