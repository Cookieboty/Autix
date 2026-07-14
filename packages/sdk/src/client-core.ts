import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import {
  fetchEventSource,
  type FetchEventSourceInit,
} from '@microsoft/fetch-event-source';
import { DEFAULT_LANGUAGE } from '@autix/i18n';
import { getAuth, getNavigation, getEnv, getStorage } from '@autix/platform';
import type { ApiResponse, ApiResponseHint, TaskEvent } from '@autix/domain';
import { isStepUpErrorCode } from '@autix/domain';
import type {
  CanvasAction,
  CanvasActionEstimate,
  CanvasBoard,
  CanvasBoardState,
  CanvasEntitlement,
} from '@autix/domain';
import {
  matchInsufficientPointsMessage,
  parseInsufficientPointsMessage,
  reportInsufficientPoints,
} from './insufficient-points-reporter';

export type { FetchEventSourceInit };

export type { ApiResponse };

type RefreshPayload = {
  accessToken: string;
  refreshToken: string;
};

export class AuthRefreshError extends Error {
  constructor(
    message: string,
    public readonly terminal: boolean,
  ) {
    super(message);
    this.name = 'AuthRefreshError';
  }
}

let refreshPromise: Promise<string | null> | null = null;
const REFRESH_LOCK_KEY = 'autix.auth.refresh.lock';
const REFRESH_EVENT_KEY = 'autix.auth.refresh.event';
const REFRESH_LOCK_TTL_MS = 8000;
const REFRESH_LOCK_WAIT_MS = 250;
export const LLM_REQUEST_TIMEOUT_MS = 10 * 60 * 1000;

export function normalizeApiBase(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '').replace(/\/api$/, '');
}

function normalizeApiPath(url?: string): string | undefined {
  if (!url || /^https?:\/\//.test(url)) return url;
  const path = url.startsWith('/') ? url : `/${url}`;
  if (path === '/api' || path.startsWith('/api/')) return path;
  return `/api${path}`;
}

export function getApiBaseUrl(): string {
  const env = getEnv();
  return normalizeApiBase(env.apiUrl || env.chatApiUrl || env.userApiUrl || '');
}

export function getApiUrl(path: string, apiUrl = getApiBaseUrl()): string {
  if (/^https?:\/\//.test(path)) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${apiUrl}${normalizedPath}`;
}

function parseLock(raw: string | null): { id: string; expiresAt: number } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { id?: unknown; expiresAt?: unknown };
    if (typeof parsed.id !== 'string' || typeof parsed.expiresAt !== 'number') {
      return null;
    }
    return { id: parsed.id, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

function waitForRefreshEvent(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const storage = getStorage();
    let settled = false;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      unsubscribe?.();
      clearTimeout(timer);
      resolve();
    };
    const unsubscribe = storage.subscribe?.((event) => {
      if (
        (event.key === REFRESH_EVENT_KEY ||
          event.key === 'accessToken' ||
          event.key === 'refreshToken')
      ) {
        cleanup();
      }
    });
    const timer = setTimeout(cleanup, timeoutMs);
  });
}

async function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  const storage = getStorage();

  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
  const deadline = Date.now() + REFRESH_LOCK_TTL_MS;

  while (Date.now() < deadline) {
    const now = Date.now();
    const lock = parseLock(await storage.getItem(REFRESH_LOCK_KEY));

    if (!lock || lock.expiresAt <= now) {
      await storage.setItem(
        REFRESH_LOCK_KEY,
        JSON.stringify({ id, expiresAt: now + REFRESH_LOCK_TTL_MS }),
      );
      const currentLock = parseLock(await storage.getItem(REFRESH_LOCK_KEY));
      if (currentLock?.id === id) {
        try {
          return await fn();
        } finally {
          const latestLock = parseLock(await storage.getItem(REFRESH_LOCK_KEY));
          if (latestLock?.id === id) {
            await storage.removeItem(REFRESH_LOCK_KEY);
          }
          await storage.setItem(REFRESH_EVENT_KEY, String(Date.now()));
        }
      }
    }

    await waitForRefreshEvent(REFRESH_LOCK_WAIT_MS);
  }

  return fn();
}

function extractBearerToken(headers: unknown): string | undefined {
  if (!headers) return undefined;
  const value =
    typeof (headers as { get?: (name: string) => unknown }).get === 'function'
      ? (headers as { get: (name: string) => unknown }).get('Authorization') ??
      (headers as { get: (name: string) => unknown }).get('authorization')
      : (headers as Record<string, unknown>).Authorization ??
      (headers as Record<string, unknown>).authorization;

  if (typeof value !== 'string') return undefined;
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}

function redirectToLogin(): void {
  try {
    const navigation = getNavigation();
    if (navigation.getPathname() !== '/login') {
      navigation.push('/login');
    }
  } catch {
    // Platform navigation may not be registered during early bootstrap.
  }
}

async function clearAuthAndRedirect(): Promise<null> {
  await getAuth().clearTokens();
  redirectToLogin();
  return null;
}

function isInvalidRefreshStatus(status: number): boolean {
  return status === 400 || status === 401;
}

async function requestTokenRefresh(
  apiUrl: string,
  refreshToken: string,
): Promise<string> {
  const refreshRes = await axios.post<ApiResponse<RefreshPayload>>(
    `${normalizeApiBase(apiUrl)}/api/auth/refresh`,
    { refreshToken },
    {
      timeout: 10000,
      validateStatus: () => true,
    },
  );

  const payload = refreshRes.data;
  if (
    refreshRes.status >= 200 &&
    refreshRes.status < 300 &&
    payload?.success !== false
  ) {
    const tokens = (
      payload && typeof payload === 'object' && 'data' in payload
        ? payload.data
        : payload
    ) as RefreshPayload | undefined;
    if (tokens?.accessToken && tokens?.refreshToken) {
      await getAuth().setTokens(tokens.accessToken, tokens.refreshToken);
      await getStorage().setItem(REFRESH_EVENT_KEY, String(Date.now()));
      return tokens.accessToken;
    }
  }

  if (isInvalidRefreshStatus(refreshRes.status)) {
    throw new AuthRefreshError('Refresh token is invalid', true);
  }

  throw new AuthRefreshError(`Refresh failed with HTTP ${refreshRes.status}`, false);
}

export async function refreshAuthSession(
  apiUrl = getApiBaseUrl(),
  options: { staleAccessToken?: string | null } = {},
): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = withRefreshLock(async () => {
      const auth = getAuth();
      const currentAccessToken = await auth.getAccessToken();
      if (
        'staleAccessToken' in options &&
        currentAccessToken &&
        currentAccessToken !== options.staleAccessToken
      ) {
        return currentAccessToken;
      }

      const refreshToken = await auth.getRefreshToken();
      if (!refreshToken) {
        return clearAuthAndRedirect();
      }

      try {
        return await requestTokenRefresh(apiUrl, refreshToken);
      } catch (error) {
        if (error instanceof AuthRefreshError && error.terminal) {
          return clearAuthAndRedirect();
        }
        throw error;
      }
    }).finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export async function getValidAccessToken(apiUrl = getApiBaseUrl()): Promise<string | null> {
  const auth = getAuth();
  const accessToken = await auth.getAccessToken();
  if (accessToken) return accessToken;
  const refreshToken = await auth.getRefreshToken();
  if (!refreshToken) return null;
  return refreshAuthSession(apiUrl, { staleAccessToken: accessToken });
}

async function buildAuthHeaders(
  headers: HeadersInit | undefined,
  token: string | null,
): Promise<Headers> {
  const nextHeaders = new Headers(headers);
  if (token) nextHeaders.set('Authorization', `Bearer ${token}`);
  const lang = (await getAuth().getLanguage()) || DEFAULT_LANGUAGE;
  nextHeaders.set('Accept-Language', lang);
  return nextHeaders;
}

export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: { apiUrl?: string; retryOnUnauthorized?: boolean } = {},
): Promise<Response> {
  const apiUrl = options.apiUrl ?? getApiBaseUrl();
  const retryOnUnauthorized = options.retryOnUnauthorized ?? true;
  const token = await getAuth().getAccessToken();
  const response = await fetch(input, {
    ...init,
    headers: await buildAuthHeaders(init.headers, token),
  });

  if (!retryOnUnauthorized || response.status !== 401) {
    return response;
  }

  let nextToken: string | null;
  try {
    nextToken = await refreshAuthSession(apiUrl, {
      staleAccessToken: token,
    });
  } catch {
    return response;
  }
  if (!nextToken) return response;

  return fetch(input, {
    ...init,
    headers: await buildAuthHeaders(init.headers, nextToken),
  });
}

export function authFetchEventSource(
  input: RequestInfo | URL,
  init: FetchEventSourceInit,
  options: { apiUrl?: string } = {},
): Promise<void> {
  const apiUrl = options.apiUrl ?? getApiBaseUrl();
  const requestInput =
    typeof input === 'string'
      ? getApiUrl(input, apiUrl)
      : input instanceof URL
        ? input.toString()
        : input;

  return fetchEventSource(requestInput, {
    ...init,
    fetch: (requestInput, requestInit) =>
      authFetch(requestInput, requestInit, { apiUrl }),
  });
}

export async function uploadToPresignedUrl(
  uploadUrl: string,
  body: BodyInit,
  options: { contentType?: string; headers?: HeadersInit } = {},
): Promise<Response> {
  const headers = new Headers(options.headers);
  if (options.contentType) headers.set('Content-Type', options.contentType);
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    body,
    headers,
  });
  if (!response.ok) {
    throw new Error(`Presigned upload failed with status ${response.status}`);
  }
  return response;
}

export function createApiInstance(getBaseUrl: () => string, getUserApiUrl: () => string): AxiosInstance {
  const instance = axios.create({ timeout: 60000 });

  instance.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    if (!config.baseURL) {
      config.baseURL = normalizeApiBase(getBaseUrl());
    }
    config.url = normalizeApiPath(config.url);
    const auth = getAuth();
    const token = await auth.getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    const lang = (await auth.getLanguage()) || DEFAULT_LANGUAGE;
    config.headers['Accept-Language'] = lang;
    return config;
  });

  instance.interceptors.response.use(
    (res) => {
      const payload = res.data as ApiResponse<unknown>;
      if (payload && typeof payload === 'object' && 'success' in payload) {
        if (!payload.success) {
          const err = new AxiosError(payload.msg, 'API_ERROR', res.config, res.request, res);
          (err as AxiosError & { code?: string }).code = payload.code;
          (err as AxiosError & { msg?: string }).msg = payload.msg;
          (err as AxiosError & { hint?: ApiResponseHint }).hint = payload.hint;
          // 保留后端结构化错误上下文，供需要额外提示信息的业务使用。
          (err as AxiosError & { data?: unknown }).data = payload.data;
          if (matchInsufficientPointsMessage(payload.msg)) {
            const { required, available } = parseInsufficientPointsMessage(payload.msg);
            const decorated = err as AxiosError & {
              isInsufficientPoints?: boolean;
              insufficientPointsRequired?: number | null;
              insufficientPointsAvailable?: number | null;
            };
            decorated.isInsufficientPoints = true;
            decorated.insufficientPointsRequired = required;
            decorated.insufficientPointsAvailable = available;
            reportInsufficientPoints({
              msg: payload.msg,
              code: payload.code,
              required: required ?? undefined,
              available: available ?? undefined,
              url: res.config?.url,
              method: res.config?.method,
            });
          }
          return Promise.reject(err);
        }
        // 保留 payload.data 原始结构 — 不强制拆 list/pagination：
        //   - admin-style 接口：data = { list, pagination }
        //   - workspace-style 接口：data = { items, total, ... } 或裸对象/数组
        // 调用方按各自后端契约处理；同时把 pagination 暴露到 res 顶层方便复用
        const data = payload.data;
        if (data && typeof data === 'object' && 'pagination' in data) {
          (res as { pagination?: unknown }).pagination = (data as { pagination?: unknown })
            .pagination;
        }
        if (payload.hint) {
          (res as { hint?: ApiResponseHint }).hint = payload.hint;
        }
        res.data = data;
      }
      return res;
    },
    async (error: AxiosError) => {
      const original = error.config as
        | (InternalAxiosRequestConfig & { _retry?: boolean })
        | undefined;
      const res = error.response;

      if (res?.data && typeof res.data === 'object' && 'success' in res.data) {
        const payload = res.data as ApiResponse<unknown>;
        (error as AxiosError & { msg?: string; code?: string }).msg = payload.msg;
        (error as AxiosError & { msg?: string; code?: string }).code = payload.code;
        (error as AxiosError & { hint?: ApiResponseHint }).hint = payload.hint;
        // 与 2xx-but-failed 分支保持一致：把服务端结构化错误上下文透传到 error 对象上。
        (error as AxiosError & { data?: unknown }).data = payload.data;
      }

      const finalMsg =
        (error as AxiosError & { msg?: string }).msg ?? error.message ?? '';
      if (matchInsufficientPointsMessage(finalMsg)) {
        const { required, available } = parseInsufficientPointsMessage(finalMsg);
        const decorated = error as AxiosError & {
          isInsufficientPoints?: boolean;
          insufficientPointsRequired?: number | null;
          insufficientPointsAvailable?: number | null;
        };
        decorated.isInsufficientPoints = true;
        decorated.insufficientPointsRequired = required;
        decorated.insufficientPointsAvailable = available;
        reportInsufficientPoints({
          msg: finalMsg,
          code: (error as AxiosError & { code?: string }).code,
          required: required ?? undefined,
          available: available ?? undefined,
          url: original?.url,
          method: original?.method,
        });
      }

      const originalUrl = original?.url ?? '';
      const isStepUpRoute = originalUrl.includes('/auth/step-up');
      const errorCode = (error as AxiosError & { code?: string }).code;
      const shouldSkipRefresh = isStepUpRoute || isStepUpErrorCode(errorCode);

      if (
        res?.status === 401 &&
        original &&
        !shouldSkipRefresh &&
        !original.url?.includes('/auth/login') &&
        !original.url?.includes('/auth/refresh')
      ) {
        if (!original._retry) {
          original._retry = true;
          const staleAccessToken = extractBearerToken(original.headers);

          try {
            const newToken = await refreshAuthSession(getUserApiUrl(), {
              staleAccessToken: staleAccessToken ?? null,
            });
            if (newToken && original.headers) {
              original.headers.Authorization = `Bearer ${newToken}`;
              return instance(original);
            }
          } catch {
            return Promise.reject(error);
          }
        }

        await getAuth().clearTokens();
        getNavigation().push('/login');
      }

      return Promise.reject(error);
    },
  );

  return instance;
}
