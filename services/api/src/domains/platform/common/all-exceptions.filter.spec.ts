import { HttpException, HttpStatus } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import type { I18nService } from '../i18n/i18n.service';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { RateLimitedException } from './rate-limit.service';

function runFilter(exception: unknown) {
  const response = {
    status: jest.fn(),
    json: jest.fn(),
  };
  response.status.mockReturnValue(response);
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ lang: 'zh-CN' }),
    }),
  };
  const i18n = { t: jest.fn((_lang: string, key: string) => key) };

  new AllExceptionsFilter(i18n as unknown as I18nService).catch(
    exception,
    host as unknown as ArgumentsHost,
  );

  return {
    status: response.status.mock.calls[0]?.[0] as number,
    body: response.json.mock.calls[0]?.[0] as Record<string, unknown>,
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
});
