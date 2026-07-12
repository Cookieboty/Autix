import { describe, expect, it } from 'bun:test';
import {
  extractAuthErrorPayload,
  translateAuthError,
  AUTH_ERROR_CODE_I18N,
} from '../src/security/error-map';

const fakeT = (key: string) => `[[${key}]]`;

describe('extractAuthErrorPayload', () => {
  it('axios error 形态：err.response.data.code + message + retryAfterMs', () => {
    const err = {
      response: {
        data: { code: 'STEP_UP_INVALID_OR_EXPIRED', message: 'bad', retryAfterMs: 5000 },
      },
    };
    expect(extractAuthErrorPayload(err)).toEqual({
      code: 'STEP_UP_INVALID_OR_EXPIRED',
      message: 'bad',
      retryAfterMs: 5000,
    });
  });

  it('fetch/native 形态：err.body 或 err.data', () => {
    expect(extractAuthErrorPayload({ body: { code: 'OTP_INVALID', message: 'x' } })).toEqual({
      code: 'OTP_INVALID',
      message: 'x',
    });
    expect(extractAuthErrorPayload({ data: { code: 'OTP_LOCKED', message: 'y' } })).toEqual({
      code: 'OTP_LOCKED',
      message: 'y',
    });
  });

  it('平级 code/message 也识别', () => {
    expect(extractAuthErrorPayload({ code: 'TOO_MANY_REQUESTS', message: 'slow' })).toEqual({
      code: 'TOO_MANY_REQUESTS',
      message: 'slow',
    });
  });

  it('无 code/message → null', () => {
    expect(extractAuthErrorPayload({})).toBeNull();
    expect(extractAuthErrorPayload(null)).toBeNull();
    expect(extractAuthErrorPayload('string-err')).toBeNull();
  });

  it('缺 message 时补空串', () => {
    const p = extractAuthErrorPayload({ code: 'STEP_UP_INVALID_OR_EXPIRED' });
    expect(p?.code).toBe('STEP_UP_INVALID_OR_EXPIRED');
    expect(p?.message).toBe('');
  });
});

describe('translateAuthError', () => {
  it('命中已知 code → 返回 i18n key 翻译', () => {
    const err = { response: { data: { code: 'STEP_UP_INVALID_OR_EXPIRED', message: 'x' } } };
    expect(translateAuthError(err, fakeT, 'fallback')).toBe(
      `[[${AUTH_ERROR_CODE_I18N.STEP_UP_INVALID_OR_EXPIRED}]]`,
    );
  });

  it('未知 code → 返回后端 message', () => {
    const err = { response: { data: { code: 'CUSTOM_ERR', message: 'server said no' } } };
    expect(translateAuthError(err, fakeT, 'fallback')).toBe('server said no');
  });

  it('未知 code 且无 message → fallback', () => {
    const err = { response: { data: { code: 'CUSTOM_ERR' } } };
    expect(translateAuthError(err, fakeT, 'fallback')).toBe('fallback');
  });

  it('提取不到 payload → fallback', () => {
    expect(translateAuthError(new Error('net'), fakeT, 'fallback')).toBe('fallback');
  });
});

describe('AUTH_ERROR_CODE_I18N', () => {
  it('账号自助错误码都有对应 i18n key', () => {
    expect(AUTH_ERROR_CODE_I18N.STEP_UP_INVALID_OR_EXPIRED).toBe('auth.errorCodes.STEP_UP_INVALID_OR_EXPIRED');
    expect(AUTH_ERROR_CODE_I18N.STEP_UP_UNAVAILABLE).toBe('auth.errorCodes.STEP_UP_UNAVAILABLE');
    expect(AUTH_ERROR_CODE_I18N.OTP_INVALID).toBe('auth.errorCodes.OTP_INVALID');
    expect(AUTH_ERROR_CODE_I18N.OTP_LOCKED).toBe('auth.errorCodes.OTP_LOCKED');
    expect(AUTH_ERROR_CODE_I18N.OTP_ALREADY_CONSUMED).toBe('auth.errorCodes.OTP_ALREADY_CONSUMED');
    expect(AUTH_ERROR_CODE_I18N.TOO_MANY_REQUESTS).toBe('auth.errorCodes.TOO_MANY_REQUESTS');
    expect(AUTH_ERROR_CODE_I18N.USER_DELETED).toBe('auth.errorCodes.USER_DELETED');
  });
});
