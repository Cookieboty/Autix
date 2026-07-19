import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authFetch } from './client-core';
import { registerPlatform } from '@autix/platform';

function createAuthHarness(initialTokens = { access: 'old-access', refresh: 'refresh-1' }) {
  let accessToken: string | null = initialTokens.access;
  let refreshToken: string | null = initialTokens.refresh;
  let clearCount = 0;
  const pushed: string[] = [];

  registerPlatform({
    auth: {
      getAccessToken: async () => accessToken,
      getRefreshToken: async () => refreshToken,
      setTokens: async (access, refresh) => {
        accessToken = access;
        refreshToken = refresh;
      },
      clearTokens: async () => {
        clearCount += 1;
        accessToken = null;
        refreshToken = null;
      },
      getUser: async () => null,
      setUser: async () => {},
      getLanguage: async () => 'zh-CN',
      setLanguage: async () => {},
    },
    navigation: {
      push: (path) => {
        pushed.push(path);
      },
      replace: (path) => {
        pushed.push(path);
      },
      getPathname: () => '/',
      switchLocale: () => {},
    },
    env: {
      apiUrl: 'https://api.example.test',
      chatApiUrl: '',
      userApiUrl: '',
    },
  });

  return {
    get accessToken() {
      return accessToken;
    },
    get refreshToken() {
      return refreshToken;
    },
    get clearCount() {
      return clearCount;
    },
    pushed,
  };
}

describe('auth refresh helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refreshes and retries authFetch after a 401', async () => {
    const auth = createAuthHarness();
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        calls.push(new Headers(init?.headers).get('Authorization') ?? '');
        if (calls.length === 1) return new Response(null, { status: 401 });
        return new Response('ok', { status: 200 });
      }),
    );

    const axios = await import('axios');
    vi.spyOn(axios.default, 'post').mockResolvedValue({
      status: 200,
      data: {
        success: true,
        data: { accessToken: 'new-access', refreshToken: 'refresh-2' },
      },
    });

    const response = await authFetch('https://api.example.test/api/things');

    expect(response.status).toBe(200);
    expect(calls).toEqual(['Bearer old-access', 'Bearer new-access']);
    expect(auth.accessToken).toBe('new-access');
    expect(auth.refreshToken).toBe('refresh-2');
    expect(auth.clearCount).toBe(0);
  });

  it('does not clear tokens for transient refresh failures', async () => {
    const auth = createAuthHarness();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 401 })),
    );

    const axios = await import('axios');
    vi.spyOn(axios.default, 'post').mockResolvedValue({
      status: 500,
      data: { success: false, data: null },
    });

    const response = await authFetch('https://api.example.test/api/things');

    expect(response.status).toBe(401);
    expect(auth.accessToken).toBe('old-access');
    expect(auth.refreshToken).toBe('refresh-1');
    expect(auth.clearCount).toBe(0);
    expect(auth.pushed).toEqual([]);
  });

  it('shares one refresh request across concurrent authFetch 401s', async () => {
    createAuthHarness();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const authHeader = new Headers(init?.headers).get('Authorization');
        return new Response(null, { status: authHeader === 'Bearer new-access' ? 200 : 401 });
      }),
    );

    const axios = await import('axios');
    const post = vi.spyOn(axios.default, 'post').mockResolvedValue({
      status: 200,
      data: {
        success: true,
        data: { accessToken: 'new-access', refreshToken: 'refresh-2' },
      },
    });

    const [first, second] = await Promise.all([
      authFetch('https://api.example.test/api/one'),
      authFetch('https://api.example.test/api/two'),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(post).toHaveBeenCalledTimes(1);
  });

  // 评审 P2 回归：401 重试必须重新生成 X-Request-Id（一次 HTTP 请求 = 一个 request ID），
  // 且不能因为调用方预置了小写 x-request-id 而被沿用；同时会话级 X-Correlation-Id 必须
  // 在重试请求里原样保留，服务端才能把两次请求聚合到同一会话。
  describe('401 retry preserves per-request X-Request-Id / X-Correlation-Id (评审 P2)', () => {
    it('第一次和重试的 X-Request-Id 不同', async () => {
      createAuthHarness();
      const requestIds: Array<string | null> = [];
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
          const headers = new Headers(init?.headers);
          requestIds.push(headers.get('X-Request-Id'));
          return new Response(null, {
            status: requestIds.length === 1 ? 401 : 200,
          });
        }),
      );
      const axios = await import('axios');
      vi.spyOn(axios.default, 'post').mockResolvedValue({
        status: 200,
        data: {
          success: true,
          data: { accessToken: 'new-access', refreshToken: 'refresh-2' },
        },
      });

      const res = await authFetch('https://api.example.test/api/tick');

      expect(res.status).toBe(200);
      expect(requestIds).toHaveLength(2);
      expect(requestIds[0]).toBeTruthy();
      expect(requestIds[1]).toBeTruthy();
      expect(requestIds[1]).not.toBe(requestIds[0]);
    });

    it('调用方预置小写 x-request-id 时，重试会删除预置值并生成新的 X-Request-Id', async () => {
      // 这是 P2 修复的核心：buildAuthHeaders 里的 `!nextHeaders.has(REQUEST_ID_HEADER)`
      // 会因预置值存在而拒绝写入新 ID；重试前必须先克隆 headers 并删掉预置 request-id。
      createAuthHarness();
      const requestIds: Array<string | null> = [];
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
          const headers = new Headers(init?.headers);
          requestIds.push(headers.get('X-Request-Id'));
          return new Response(null, {
            status: requestIds.length === 1 ? 401 : 200,
          });
        }),
      );
      const axios = await import('axios');
      vi.spyOn(axios.default, 'post').mockResolvedValue({
        status: 200,
        data: {
          success: true,
          data: { accessToken: 'new-access', refreshToken: 'refresh-2' },
        },
      });

      const preset = 'caller-lowercase-req-12345';
      const res = await authFetch('https://api.example.test/api/tick', {
        headers: { 'x-request-id': preset },
      });

      expect(res.status).toBe(200);
      // 第一次沿用调用方预置（尊重外部链路）。
      expect(requestIds[0]).toBe(preset);
      // 重试必须换成新的 ID，不再复用调用方预置值。
      expect(requestIds[1]).toBeTruthy();
      expect(requestIds[1]).not.toBe(preset);
    });

    it('调用方设置的 X-Correlation-Id 在两次请求间保持不变', async () => {
      // 会话级 ID 用途正好相反：轮询/重试都属于同一会话，应保留供服务端聚合。
      createAuthHarness();
      const correlationIds: Array<string | null> = [];
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
          const headers = new Headers(init?.headers);
          correlationIds.push(headers.get('X-Correlation-Id'));
          return new Response(null, {
            status: correlationIds.length === 1 ? 401 : 200,
          });
        }),
      );
      const axios = await import('axios');
      vi.spyOn(axios.default, 'post').mockResolvedValue({
        status: 200,
        data: {
          success: true,
          data: { accessToken: 'new-access', refreshToken: 'refresh-2' },
        },
      });

      const corr = 'poll-video-abc-123';
      const res = await authFetch('https://api.example.test/api/tick', {
        headers: { 'X-Correlation-Id': corr },
      });

      expect(res.status).toBe(200);
      expect(correlationIds).toEqual([corr, corr]);
    });
  });
});
