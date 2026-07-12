import type { ErrorCode } from '@autix/domain';

type AuthErrorPayload = {
  code: string;
  message: string;
  retryAfterMs?: number;
};

/**
 * 后端契约层 code → i18n key 的直接映射。
 * 保持 1:1，前端只需 `t(errorCodeToI18nKey(code))`。
 */
export const AUTH_ERROR_CODE_I18N: Partial<Record<ErrorCode, string>> = {
  STEP_UP_INVALID_OR_EXPIRED: 'auth.errorCodes.STEP_UP_INVALID_OR_EXPIRED',
  STEP_UP_UNAVAILABLE: 'auth.errorCodes.STEP_UP_UNAVAILABLE',
  OTP_INVALID: 'auth.errorCodes.OTP_INVALID',
  OTP_LOCKED: 'auth.errorCodes.OTP_LOCKED',
  OTP_ALREADY_CONSUMED: 'auth.errorCodes.OTP_ALREADY_CONSUMED',
  TOO_MANY_REQUESTS: 'auth.errorCodes.TOO_MANY_REQUESTS',
  USER_DELETED: 'auth.errorCodes.USER_DELETED',
  ACCOUNT_DELETE_CONFIRMATION_MISMATCH: 'auth.errorCodes.ACCOUNT_DELETE_CONFIRMATION_MISMATCH',
};

/**
 * 从 axios/fetch 抛出的错误里提取后端 payload。
 * 只识别嵌套形态：
 *   axios: err.response.data.code / .message / .dimensionKey / .retryAfterMs
 *   fetch/native: err.body / err.data
 *   或者 err 本身就是 payload 对象（{code, message}）
 * 纯 `Error` 实例（只有 err.message 是本地网络文案）不识别为后端 payload。
 */
export function extractAuthErrorPayload(err: unknown): AuthErrorPayload | null {
  if (!err || typeof err !== 'object') return null;
  const anyErr = err as {
    response?: { data?: unknown };
    body?: unknown;
    data?: unknown;
    code?: unknown;
    message?: unknown;
  };
  // 优先从后端返回位置取
  const nested =
    (anyErr.response && (anyErr.response as { data?: unknown }).data) ??
    anyErr.body ??
    anyErr.data ??
    null;

  let candidate: Record<string, unknown> | null = null;
  if (nested && typeof nested === 'object') {
    candidate = nested as Record<string, unknown>;
  } else if (typeof anyErr.code === 'string') {
    // 平级 { code, message } 才认；只有 message 不认（避免匹配到 Error.message）
    candidate = anyErr as Record<string, unknown>;
  }

  if (!candidate) return null;
  const code = typeof candidate.code === 'string' ? candidate.code : undefined;
  const message = typeof candidate.message === 'string' ? candidate.message : undefined;
  if (!code && !message) return null;
  return {
    code: code ?? 'UNKNOWN',
    message: message ?? '',
    retryAfterMs: typeof candidate.retryAfterMs === 'number' ? candidate.retryAfterMs : undefined,
  };
}

/**
 * 一步到位：拿到 axios error，返回 i18n 已翻译的用户可见文案。
 * 未命中已知 code 时返回后端 message 或 fallback。
 */
export function translateAuthError(
  err: unknown,
  translate: (key: string) => string,
  fallback: string,
): string {
  const payload = extractAuthErrorPayload(err);
  if (!payload) return fallback;
  const key = AUTH_ERROR_CODE_I18N[payload.code as ErrorCode];
  if (key) return translate(key);
  return payload.message || fallback;
}
