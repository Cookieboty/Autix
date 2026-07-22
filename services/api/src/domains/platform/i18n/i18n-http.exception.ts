import { HttpException, HttpStatus } from '@nestjs/common';
import type { ApiResponseHint, ErrorCode } from '@autix/domain';

/**
 * An HttpException that carries an i18n message key instead of a raw string.
 * The AllExceptionsFilter will translate the key using I18nService.
 *
 * spec §3.2 G：翻译类业务错误也必须能携带稳定业务码与 hint，否则 filter 只能按 HTTP status
 * 把 `STEP_UP_UNAVAILABLE` 等业务码降级成 `CONFLICT/BAD_REQUEST`。
 * `meta.code` / `meta.hint` 存为公开只读属性并写入 `getResponse()` payload，供 filter 透出。
 *
 * `meta.data` 允许翻译型异常携带结构化上下文（如 DTO 校验的 violations、金额溢出的 max/min），
 * 由 filter 原样透出到 envelope `data`；文案仍由 i18nKey 翻译，避免把参数值直接拼到 msg。
 */
export class I18nHttpException extends HttpException {
  public readonly i18nKey: string;
  public readonly i18nArgs?: Record<string, unknown>;
  public readonly code?: ErrorCode;
  public readonly hint?: ApiResponseHint;
  public readonly retryAfterMs?: number;
  public readonly data?: unknown;

  constructor(
    status: HttpStatus,
    key: string,
    args?: Record<string, unknown>,
    meta?: {
      code?: ErrorCode;
      hint?: ApiResponseHint;
      retryAfterMs?: number;
      data?: unknown;
    },
  ) {
    super(
      {
        i18nKey: key,
        i18nArgs: args,
        code: meta?.code,
        hint: meta?.hint,
        retryAfterMs: meta?.retryAfterMs,
        data: meta?.data,
      },
      status,
    );
    this.i18nKey = key;
    this.i18nArgs = args;
    this.code = meta?.code;
    this.hint = meta?.hint;
    this.retryAfterMs = meta?.retryAfterMs;
    this.data = meta?.data;
  }
}
