import { ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ThrottlerLimitDetail } from '@nestjs/throttler';
import { I18nHttpException } from '../i18n/i18n-http.exception';

/**
 * 默认的 `ThrottlerGuard` 会抛官方 `ThrottlerException`，其 message 硬编码为
 * "ThrottlerException: Too Many Requests"，走到 `AllExceptionsFilter` 的普通
 * `HttpException` 分支后原样透传给前端，永远英文。
 *
 * 这里覆盖官方扩展点 `throwThrottlingException`，把限流异常转换成
 * `I18nHttpException`，让它复用现有 i18n 通道：
 *   - `common.too_many_requests` 词条按 `req.lang` 翻译；
 *   - `code: 'TOO_MANY_REQUESTS'` 稳定业务码给前端做兜底/退避判定；
 *   - `retryAfterMs` 由 throttler 计算好的 `timeToBlockExpire` 折算（秒 → 毫秒），
 *     透出到统一 envelope，前端可用于倒计时；HTTP Header 层面官方守卫已经写好
 *     `Retry-After`，这里只是把语义补进响应体。
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(
    _context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const retryAfterMs = Math.max(0, Math.round(throttlerLimitDetail.timeToBlockExpire * 1000));
    throw new I18nHttpException(
      HttpStatus.TOO_MANY_REQUESTS,
      'common.too_many_requests',
      undefined,
      { code: 'TOO_MANY_REQUESTS', retryAfterMs },
    );
  }
}
