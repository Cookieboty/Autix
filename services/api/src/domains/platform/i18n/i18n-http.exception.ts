import { HttpException, HttpStatus } from '@nestjs/common';
import type { ApiResponseHint, ErrorCode } from '@autix/domain';

/**
 * An HttpException that carries an i18n message key instead of a raw string.
 * The AllExceptionsFilter will translate the key using I18nService.
 *
 * spec §3.2 G：翻译类业务错误也必须能携带稳定业务码与 hint，否则 filter 只能按 HTTP status
 * 把 `STEP_UP_UNAVAILABLE` 等业务码降级成 `CONFLICT/BAD_REQUEST`。
 * `meta.code` / `meta.hint` 存为公开只读属性并写入 `getResponse()` payload，供 filter 透出。
 */
export class I18nHttpException extends HttpException {
  public readonly i18nKey: string;
  public readonly i18nArgs?: Record<string, unknown>;
  public readonly code?: ErrorCode;
  public readonly hint?: ApiResponseHint;

  constructor(
    status: HttpStatus,
    key: string,
    args?: Record<string, unknown>,
    meta?: { code?: ErrorCode; hint?: ApiResponseHint },
  ) {
    super(
      { i18nKey: key, i18nArgs: args, code: meta?.code, hint: meta?.hint },
      status,
    );
    this.i18nKey = key;
    this.i18nArgs = args;
    this.code = meta?.code;
    this.hint = meta?.hint;
  }
}
