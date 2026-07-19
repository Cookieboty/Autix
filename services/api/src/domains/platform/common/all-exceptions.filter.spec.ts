import { HttpException, HttpStatus } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import type { I18nService } from '../i18n/i18n.service';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { RateLimitedException } from './rate-limit.service';

function runFilter(exception: unknown) {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
    setHeader: vi.fn(),
    headersSent: false,
  };
  response.status.mockReturnValue(response);
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ lang: 'zh-CN' }),
    }),
  };
  const i18n = { t: vi.fn((_lang: string, key: string) => key) };

  new AllExceptionsFilter(i18n as unknown as I18nService).catch(
    exception,
    host as unknown as ArgumentsHost,
  );

  return {
    status: response.status.mock.calls[0]?.[0] as number,
    body: response.json.mock.calls[0]?.[0] as Record<string, unknown>,
    setHeader: response.setHeader,
  };
}

describe('AllExceptionsFilter error envelope', () => {
  it('keeps structured hint at the top level and only puts business data in data', () => {
    const hint = {
      i18nKey: 'auth.errorCodes.STEP_UP_UNAVAILABLE',
      params: { provider: 'github' },
    };
    const result = runFilter(new HttpException({
      code: 'STEP_UP_UNAVAILABLE',
      message: 'Self-service unavailable',
      hint,
      data: { recovery: 'CONTACT_SUPPORT' },
    }, HttpStatus.CONFLICT));

    expect(result.status).toBe(409);
    expect(result.body).toMatchObject({
      success: false,
      code: 'STEP_UP_UNAVAILABLE',
      msg: 'Self-service unavailable',
      hint,
      data: { recovery: 'CONTACT_SUPPORT' },
    });
  });

  it('promotes retryAfterMs to the top level without duplicating it in data', () => {
    const result = runFilter(new RateLimitedException(42_000));

    expect(result.status).toBe(429);
    expect(result.body).toMatchObject({
      success: false,
      code: 'TOO_MANY_REQUESTS',
      msg: 'Too many requests',
      retryAfterMs: 42_000,
      data: null,
    });
  });

  it('maps a bare 429 exception to the stable TOO_MANY_REQUESTS code', () => {
    const result = runFilter(new HttpException('Slow down', HttpStatus.TOO_MANY_REQUESTS));

    expect(result.status).toBe(429);
    expect(result.body).toMatchObject({
      code: 'TOO_MANY_REQUESTS',
      msg: 'Slow down',
    });
  });

  it('preserves FEATURE_DISABLED code and structured hint', () => {
    const hint = { i18nKey: 'profile.avatarUploadDisabled' };
    const result = runFilter(new HttpException({
      code: 'FEATURE_DISABLED',
      message: 'Feature disabled',
      hint,
    }, HttpStatus.BAD_REQUEST));

    expect(result.body).toMatchObject({ code: 'FEATURE_DISABLED', hint, data: null });
  });

  it('writes the fallback traceId to X-Request-Id header when no trace context is active', () => {
    // 评审 P2：上下文缺失时 filter 生成 `err-<uuid>` 兜底 ID。这条 ID 必须同时
    // 出现在响应头和响应体，前端才能把早期错误关联回自己的日志。
    const result = runFilter(new Error('boom'));

    const bodyTraceId = String((result.body as { traceId: string }).traceId);
    expect(bodyTraceId).toMatch(/^err-/);

    const headerCall = result.setHeader.mock.calls.find(
      ([name]) => name === 'X-Request-Id',
    );
    expect(headerCall?.[1]).toBe(bodyTraceId);
  });

  it('recognises real body-parser errors (Error + expose + whitelisted type) as 4xx', () => {
    // 评审 P2 收窄后的白名单路径：这是 body-parser 真实抛出的错误形态。
    class PayloadTooLargeError extends Error {
      status = 413;
      statusCode = 413;
      type = 'entity.too.large';
      expose = true as const;
      constructor() {
        super('request entity too large');
      }
    }
    const result = runFilter(new PayloadTooLargeError());
    expect(result.status).toBe(413);
    expect(result.body).toMatchObject({
      code: 'PAYLOAD_TOO_LARGE',
      msg: 'request entity too large',
      data: null,
    });
  });

  it('does NOT trust arbitrary { status, message } third-party errors (falls back to 500)', () => {
    // 评审 P2：早期实现只看 status/statusCode+message，会把上游 SDK 的
    // { status: 404, message: "user gone" } 直接作为 404 返回并暴露 message。
    // 收窄后：缺少 expose:true 与白名单 type，必须回落到 500 兜底。
    const rogue = Object.assign(new Error('user gone'), { status: 404 });
    const result = runFilter(rogue);
    expect(result.status).toBe(500);
    expect(result.body).toMatchObject({
      code: 'INTERNAL_ERROR',
      // 客户端只应看到 i18n 兜底文案，而不是上游原始 message。
      msg: 'common.internal_error',
    });
  });

  it('does NOT recognise unknown body-parser type as http-error (falls back to 500)', () => {
    // 白名单命中失败 → 走 500 分支。防止第三方错误因碰巧带 expose+status 而绕过。
    const fake = Object.assign(new Error('mystery'), {
      status: 400,
      expose: true,
      type: 'some.custom.parser.thing',
    });
    const result = runFilter(fake);
    expect(result.status).toBe(500);
    expect(result.body).toMatchObject({
      code: 'INTERNAL_ERROR',
      msg: 'common.internal_error',
    });
  });
});
