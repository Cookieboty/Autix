import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import type { ApiResponse, ApiResponseHint, ErrorCode } from '@autix/domain';
import { I18nService } from '../i18n/i18n.service';
import { I18nHttpException } from '../i18n/i18n-http.exception';
import { DEFAULT_LANGUAGE } from '@autix/i18n';

type LocalizedRequest = Request & { lang?: string };
type HttpExceptionResponse = {
  message?: string | string[];
  code?: string;
  hint?: ApiResponseHint;
  retryAfterMs?: number;
  /** 可选的结构化错误上下文。 */
  data?: unknown;
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly i18n: I18nService) { }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<LocalizedRequest>();
    const lang = request.lang ?? DEFAULT_LANGUAGE;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = 'INTERNAL_ERROR';
    let message = this.i18n.t(lang, 'common.internal_error');
    let payloadData: unknown = null;
    let hint: ApiResponseHint | undefined;
    let retryAfterMs: number | undefined;

    if (exception instanceof I18nHttpException) {
      status = exception.getStatus();
      message = this.i18n.t(lang, exception.i18nKey, exception.i18nArgs);
      // 优先使用异常自带的稳定业务码/hint，缺省才按 HTTP status 映射（spec §3.2 G）。
      code = exception.code ?? this.statusToCode(status);
      hint = exception.hint;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse() as string | HttpExceptionResponse;
      const responseMessage =
        typeof exResponse === 'string'
          ? exResponse
          : (exResponse.message ?? exception.message);

      message = Array.isArray(responseMessage)
        ? responseMessage.join(', ')
        : responseMessage;

      code =
        typeof exResponse === 'object' && typeof exResponse.code === 'string'
          ? (exResponse.code as ErrorCode)
          : this.statusToCode(status);

      // hint/retryAfterMs 是稳定 envelope 字段；其他结构化上下文才进入 data。
      if (typeof exResponse === 'object' && exResponse !== null) {
        hint = exResponse.hint;
        retryAfterMs = exResponse.retryAfterMs;
        if ('data' in exResponse && exResponse.data !== undefined) {
          payloadData = exResponse.data;
        } else {
          const extras: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(exResponse)) {
            if (
              key === 'message' ||
              key === 'code' ||
              key === 'statusCode' ||
              key === 'error' ||
              key === 'hint' ||
              key === 'retryAfterMs'
            ) continue;
            extras[key] = value;
          }
          if (Object.keys(extras).length > 0) {
            payloadData = extras;
          }
        }
      }
    }

    if (status >= 500 || !(exception instanceof HttpException)) {
      this.logger.error(
        'Unhandled exception',
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const traceId = crypto.randomUUID();
    const body: ApiResponse<unknown> & { retryAfterMs?: number } = {
      success: false,
      code,
      msg: message as string,
      traceId,
      data: payloadData,
    };
    if (hint) body.hint = hint;
    if (retryAfterMs !== undefined) body.retryAfterMs = retryAfterMs;

    response.status(status).json(body);
  }

  private statusToCode(status: number): ErrorCode {
    switch (status) {
      case 400: return 'BAD_REQUEST';
      case 401: return 'UNAUTHORIZED';
      case 403: return 'FORBIDDEN';
      case 404: return 'NOT_FOUND';
      case 409: return 'CONFLICT';
      case 429: return 'TOO_MANY_REQUESTS';
      default: return 'INTERNAL_ERROR';
    }
  }
}
