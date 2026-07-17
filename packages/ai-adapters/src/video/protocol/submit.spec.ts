import { describe, it, expect, vi, afterEach } from 'vitest';
import { submitVideoTask, queryVideoTask } from './submit';
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

  // taskIdPath 是候选链：Ark 的提交响应同时有 id 与 task_id，现有实现取 id。
  it('falls back through the taskId candidate chain', async () => {
    stubPublicDns();
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ task_id: 'task_2' }), { status: 200 }));
    expect((await submitVideoTask(args)).providerTaskId).toBe('task_2');
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
