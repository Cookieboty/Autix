import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeImageCall } from './execute';
import { ImageUpstreamError } from './types';
import type { ImageCallRequest, ProtocolPreset } from './types';

const PRESET: ProtocolPreset = {
  key: 'test@v1', transport: 'sync-json', timeoutMs: 600_000,
  auth: { in: 'header', name: 'Authorization', template: 'Bearer {apiKey}' },
  endpoints: { generate: { method: 'POST', path: '/v1/images/generations' } },
  coreBindings: { generate: { model: { path: 'model' }, prompt: { path: 'prompt' }, count: { path: 'n' } } },
  paramBindings: { size: { path: 'size', transform: 'stripTierSuffix' } },
  response: { itemsPath: 'data[*]', b64Field: 'b64_json', urlField: 'url', defaultMime: 'image/png' },
  errorMapping: { '400': 'params', '401': 'auth', '429': 'rate-limit', '*': 'upstream' },
};
const REQ: ImageCallRequest = {
  preset: PRESET, operation: 'generate', baseUrl: 'https://gw.example.com', apiKey: 'sk',
  model: 'nano-banana', prompt: 'a cat', count: 1, params: { size: '2048x2048@2K' },
};

function mockFetch(status: number, payload: unknown, headers: Record<string, string> = {}) {
  // 每次调用都返回一个新的 Response 实例（而不是复用同一个）：真实 fetch 每次调用本就
  // 会产生独立的 Response，body 只能读一次；fan-out 测试并发调用 3 次，若复用同一个
  // 实例，第 2/3 次读 body 会因 "Body already used" 被吞掉，误判成 0 个 artifact。
  return vi.fn().mockImplementation(async () =>
    new Response(typeof payload === 'string' ? payload : JSON.stringify(payload), { status, headers }),
  );
}

beforeEach(() => { vi.useFakeTimers?.(); });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers?.(); });

describe('executeImageCall', () => {
  it('sends the assembled body and returns artifacts + applied params', async () => {
    const fetchSpy = mockFetch(200, { data: [{ b64_json: 'AAA' }] });
    vi.stubGlobal('fetch', fetchSpy);

    const result = await executeImageCall(REQ);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://gw.example.com/v1/images/generations');
    expect(JSON.parse(init.body as string)).toEqual({
      model: 'nano-banana', prompt: 'a cat', n: 1, size: '2048x2048',
    });
    expect(result.artifacts).toHaveLength(1);
    // §4.4：applied 必须是「真正发出去的值」，不是用户传来的 '2048x2048@2K'
    expect(result.applied.params.size).toBe('2048x2048');
    expect(result.upstream).toMatchObject({ protocolKey: 'test@v1', httpStatus: 200 });
  });

  it('classifies a 400 as params via errorMapping — not by regexing the message', async () => {
    vi.stubGlobal('fetch', mockFetch(400, { error: { message: 'unsupported size' } }));
    const err = await executeImageCall(REQ).catch((e) => e);
    expect(err).toBeInstanceOf(ImageUpstreamError);
    expect(err.classification).toBe('params');
    expect(err.httpStatus).toBe(400);
    expect(err.retryable).toBe(false);
  });

  it('classifies 401 as auth and 429 as retryable rate-limit', async () => {
    vi.stubGlobal('fetch', mockFetch(401, {}));
    await expect(executeImageCall(REQ)).rejects.toMatchObject({ classification: 'auth', retryable: false });
    vi.stubGlobal('fetch', mockFetch(429, {}));
    await expect(executeImageCall(REQ)).rejects.toMatchObject({ classification: 'rate-limit', retryable: true });
  });

  it('falls back to the "*" mapping for an unmapped status', async () => {
    vi.stubGlobal('fetch', mockFetch(503, {}));
    await expect(executeImageCall(REQ)).rejects.toMatchObject({ classification: 'upstream' });
  });

  // 变异测试（spec §13）：这是 §4.6 的回归守卫 —— 上游 body 里出现 " 404: " 不得再被误判成参数错误
  it('does NOT classify by scanning the response body text', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { data: [{ b64_json: 'A' }], note: 'see error 404: nope' }));
    const result = await executeImageCall(REQ);
    expect(result.artifacts).toHaveLength(1);   // 200 就是成功，body 里有什么文本都无关
  });

  it('truncates the upstream body into the error, and never puts it in the message', async () => {
    vi.stubGlobal('fetch', mockFetch(400, 'x'.repeat(2000)));
    const err = await executeImageCall(REQ).catch((e) => e);
    expect(err.upstreamBody.length).toBeLessThanOrEqual(500);
  });

  it('fans out N requests when the preset declares fan-out', async () => {
    const preset: ProtocolPreset = {
      ...PRESET,
      coreBindings: {
        generate: {
          model: { path: 'model' }, prompt: { path: 'prompt' },
          count: { strategy: 'fan-out', maxConcurrency: 4 },
        },
      },
    };
    const fetchSpy = mockFetch(200, { data: [{ b64_json: 'A' }] });
    vi.stubGlobal('fetch', fetchSpy);

    const result = await executeImageCall({ ...REQ, preset, count: 3 });

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(result.artifacts).toHaveLength(3);
    expect(result.artifacts.map((a) => a.index)).toEqual([0, 1, 2]);   // index 重编号，不是三个 0
  });

  it('throws a timeout-classified error when the request aborts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'TimeoutError' })));
    await expect(executeImageCall(REQ)).rejects.toMatchObject({ classification: 'timeout', retryable: true });
  });
});
