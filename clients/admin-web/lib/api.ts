import axios from 'axios';
import { clearAuth } from '@/lib/auth';
import { DEFAULT_LANGUAGE } from '@autix/i18n';

const BASE_URL = process.env.NEXT_PUBLIC_USER_API_URL || 'http://localhost:4002/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const lang = localStorage.getItem('language') || DEFAULT_LANGUAGE;
    config.headers['Accept-Language'] = lang;
  }
  return config;
});

// Refresh lock — ensures only one /auth/refresh call is in-flight at a time.
let refreshPromise: Promise<void> | null = null;

async function doRefresh(): Promise<void> {
  const refreshToken = typeof window !== 'undefined'
    ? localStorage.getItem('refreshToken')
    : null;

  if (!refreshToken) {
    clearAuth();
    window.location.href = '/login';
    return;
  }

  try {
    // Use bare axios to avoid interceptor recursion.
    // The user-system ResponseInterceptor wraps the body as:
    //   { success, code, msg, traceId, data: { accessToken, refreshToken, refreshIn } }
    const { data: wrapped } = await axios.post(
      `${BASE_URL}/auth/refresh`,
      { refreshToken },
    );
    const tokens = wrapped.data as { accessToken: string; refreshToken: string };
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
  } catch {
    clearAuth();
    window.location.href = '/login';
  }
}

api.interceptors.response.use(
  (response) => {
    // Unwrap { success, code, msg, traceId, data: { list, pagination } }
    const payload = response.data;
    if (payload && typeof payload === 'object' && 'success' in payload) {
      // Keep data as the full object: { list: [...], pagination: {...} }
      // Extract pagination to top-level for convenience
      if (payload.data?.pagination) {
        (response as any).pagination = payload.data.pagination;
      }
      response.data = payload.data;
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const res = error.response;

    // Extract error info from wrapped response
    if (res?.data && typeof res.data === 'object' && 'success' in res.data) {
      (error as any).msg = res.data.msg;
      (error as any).code = res.data.code;
    }

    if (res?.status === 401 && !originalRequest.url?.includes('/auth/login')) {
      if (!originalRequest._retry) {
        originalRequest._retry = true;

        if (!refreshPromise) {
          refreshPromise = doRefresh().finally(() => { refreshPromise = null; });
        }

        try {
          await refreshPromise;
          const newToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
          if (newToken) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          return api.request(originalRequest);
        } catch {
          return Promise.reject(error);
        }
      }

      if (typeof window !== 'undefined') {
        clearAuth();
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export const updateMyLanguage = (language: string) =>
  api.patch('/users/me/language', { language });

export default api;
