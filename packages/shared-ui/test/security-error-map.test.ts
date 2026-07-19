import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
  // 遍历映射本身而非手抄清单：手抄会漏掉新增项，删掉实现里的条目也不会红。
  const entries = Object.entries(AUTH_ERROR_CODE_I18N);
  const catalog = JSON.parse(
    readFileSync(resolve(__dirname, '../../i18n/src/messages/auth/en.json'), 'utf8'),
  ).auth.errorCodes as Record<string, string>;

  // 目录里这两个不是抛出的错误码，是 unsupportedReason / hint，走另一条渲染路径。
  const CATALOG_ONLY = ['PROVIDER_REAUTH_UNSUPPORTED', 'CONTACT_SUPPORT'];

  it('映射恰好覆盖目录中的抛出型错误码', () => {
    expect(Object.keys(AUTH_ERROR_CODE_I18N).sort()).toEqual(
      Object.keys(catalog).filter((code) => !CATALOG_ONLY.includes(code)).sort(),
    );
  });

  it.each(entries)('%s 映射到 auth.errorCodes.%s 且目录中有文案', (code, key) => {
    expect(key).toBe(`auth.errorCodes.${code}`);
    expect(catalog).toHaveProperty(code);
  });
});
