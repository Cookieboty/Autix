import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authFetch } from './client';
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
});
