import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  HTTP_TRACE_HEADERS,
  createApiInstance,
  generateRequestId,
} from './client-core';
import { registerPlatform } from '@autix/platform';

type RequestFulfilled = (
  config: InternalAxiosRequestConfig,
) => Promise<InternalAxiosRequestConfig>;

// 极简 stub：只覆盖 client-core 请求拦截器中被调用的方法。
// 其余 setUser/getMenus 等在 request 路径上不会触发，可以省略。
const stubAuth = {
  getAccessToken: async () => 'stub-token',
  getRefreshToken: async () => null,
  setTokens: async () => undefined,
  clearTokens: async () => undefined,
  getUser: async () => null,
  setUser: async () => undefined,
  getLanguage: async () => 'zh-CN',
  setLanguage: async () => undefined,
};

const stubNavigation = {
  push: () => undefined,
  replace: () => undefined,
  getPathname: () => '/',
  switchLocale: () => undefined,
};

beforeAll(() => {
  registerPlatform({
    auth: stubAuth,
    navigation: stubNavigation,
    env: {
      apiUrl: 'https://api.example',
      chatApiUrl: 'https://api.example',
      userApiUrl: 'https://api.example',
    },
  });
});

function getRequestFulfilled(): RequestFulfilled {
  const instance = createApiInstance(
    () => 'https://api.example',
    () => 'https://api.example',
  );
  // Axios 的 handlers 数组是私有字段，但运行时可访问；用类型断言压过 TS。
  const handlers = (
    instance.interceptors.request as unknown as {
      handlers: Array<{ fulfilled: RequestFulfilled }>;
    }
  ).handlers;
  return handlers[0]!.fulfilled;
}

function makeConfig(headers: AxiosHeaders): InternalAxiosRequestConfig {
  return {
    url: '/x',
    method: 'get',
    headers,
  } as InternalAxiosRequestConfig;
}

describe('createApiInstance request interceptor', () => {
  it('生成 X-Request-Id 当调用方未提供任何 request id header', async () => {
    const fulfilled = getRequestFulfilled();
    const config = await fulfilled(makeConfig(new AxiosHeaders()));
    const headers = AxiosHeaders.from(config.headers);
    expect(headers.has(HTTP_TRACE_HEADERS.requestId)).toBe(true);
    expect(String(headers.get(HTTP_TRACE_HEADERS.requestId))).toMatch(
      /^[0-9a-f-]{20,}$/i,
    );
  });

  it('调用方传入小写 x-request-id 时不覆盖（case-insensitive）', async () => {
    // 原 P2 bug：属性索引 config.headers['X-Request-Id'] 是大小写敏感的，
    // Axios 内部会 normalize 成小写，导致 !config.headers['X-Request-Id'] 恒为 true，
    // 从而覆盖调用方 ID。这里断言修复后行为：小写 header 也被识别，不会覆盖。
    const preset = new AxiosHeaders();
    preset.set('x-request-id', 'caller-req-lower');
    const fulfilled = getRequestFulfilled();
    const config = await fulfilled(makeConfig(preset));
    const headers = AxiosHeaders.from(config.headers);
    expect(String(headers.get(HTTP_TRACE_HEADERS.requestId))).toBe(
      'caller-req-lower',
    );
  });

  it('调用方传入大写 X-Request-Id 时也保留原值', async () => {
    const preset = new AxiosHeaders();
    preset.set('X-Request-Id', 'caller-req-upper');
    const fulfilled = getRequestFulfilled();
    const config = await fulfilled(makeConfig(preset));
    const headers = AxiosHeaders.from(config.headers);
    expect(String(headers.get(HTTP_TRACE_HEADERS.requestId))).toBe(
      'caller-req-upper',
    );
  });

  it('保留调用方传入的 X-Correlation-Id（会话级 ID 不由 interceptor 生成）', async () => {
    const preset = new AxiosHeaders();
    preset.set(HTTP_TRACE_HEADERS.correlationId, 'poll-video-abc-123');
    const fulfilled = getRequestFulfilled();
    const config = await fulfilled(makeConfig(preset));
    const headers = AxiosHeaders.from(config.headers);
    expect(String(headers.get(HTTP_TRACE_HEADERS.correlationId))).toBe(
      'poll-video-abc-123',
    );
    // 同一 config 上仍会补 X-Request-Id（每个 HTTP 请求独立）。
    expect(headers.has(HTTP_TRACE_HEADERS.requestId)).toBe(true);
  });
});

describe('generateRequestId', () => {
  it('每次生成不同的 ID', () => {
    const a = generateRequestId();
    const b = generateRequestId();
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b);
  });
});
