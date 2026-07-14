import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { createApiInstance } from './client-core';
import { registerPlatform } from '@autix/platform';

// 该拦截器测的是「非 2xx HTTP 错误」分支（如 409 Conflict），区别于
// 「HTTP 2xx 但 body.success===false」分支——两者都应把 payload.data 透传到
// error 对象上，字段名保持一致（err.data）。
function registerMinimalPlatform() {
  registerPlatform({
    auth: {
      getAccessToken: async () => 'token-1',
      getRefreshToken: async () => null,
      setTokens: async () => {},
      clearTokens: async () => {},
      getUser: async () => null,
      setUser: async () => {},
      getLanguage: async () => 'zh-CN',
      setLanguage: async () => {},
    },
    navigation: {
      push: () => {},
      replace: () => {},
      getPathname: () => '/',
      switchLocale: () => {},
    },
    env: {
      apiUrl: 'https://api.example.test',
      chatApiUrl: '',
      userApiUrl: '',
    },
  });
}

/** 自定义 adapter：真实的 http/xhr adapter 在拿到响应后会用 axios 内部的
 * settle() 按 status 判断是否 reject；一个"裸" adapter 不会自动做这件事，
 * 必须自己复现——否则 409 会被当成 resolved response 直接落进
 * 2xx-but-success===false 分支，而不是这里要测的「真正非 2xx」分支。 */
function respondWith(status: number, data: unknown) {
  return async (config: InternalAxiosRequestConfig) => {
    const response = {
      data,
      status,
      statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
      headers: {},
      config,
    };
    if (status >= 200 && status < 300) return response;
    throw new AxiosError(
      `Request failed with status code ${status}`,
      AxiosError.ERR_BAD_RESPONSE,
      config,
      null,
      response as never,
    );
  };
}

describe('createApiInstance response interceptor — non-2xx error data passthrough', () => {
  beforeEach(() => {
    registerMinimalPlatform();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('copies payload.data onto the error object for a non-2xx response (e.g. 409 conflict)', async () => {
    const instance = createApiInstance(
      () => 'https://api.example.test',
      () => 'https://api.example.test',
    );

    const galleryPost = { id: 'gp-1', status: 'reviewing' };
    let caught: unknown;
    try {
      await instance.get('/creation/history/item-1', {
        adapter: respondWith(409, {
          success: false,
          code: 'CONFLICT',
          msg: '该图片已投稿到广场，请先撤回或下架后再删除',
          traceId: 't-1',
          data: { galleryPost },
        }),
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeDefined();
    const err = caught as AxiosError & { data?: unknown };
    expect(err.response?.status).toBe(409);
    expect(err.data).toEqual({ galleryPost });
  });

  it('leaves error.data undefined (and does not throw) when the non-2xx body has no data field', async () => {
    const instance = createApiInstance(
      () => 'https://api.example.test',
      () => 'https://api.example.test',
    );

    let caught: unknown;
    try {
      await instance.get('/creation/history/item-2', {
        adapter: respondWith(500, {
          success: false,
          code: 'INTERNAL_ERROR',
          msg: 'boom',
          traceId: 't-2',
        }),
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeDefined();
    const err = caught as AxiosError & { data?: unknown };
    expect(err.response?.status).toBe(500);
    expect(err.data).toBeUndefined();
  });
});
