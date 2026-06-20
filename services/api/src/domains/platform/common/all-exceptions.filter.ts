import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiResponse, ErrorCode } from '@autix/domain';
import { I18nService } from '../i18n/i18n.service';
import { I18nHttpException } from '../i18n/i18n-http.exception';

type LocalizedRequest = Request & { lang?: string };
type HttpExceptionResponse = {
  message?: string | string[];
  code?: string;
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly i18n: I18nService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<LocalizedRequest>();
    const lang = request.lang ?? 'zh-CN';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = 'INTERNAL_ERROR';
    let message = this.i18n.t(lang, 'common.internal_error');

    if (exception instanceof I18nHttpException) {
      status = exception.getStatus();
      message = this.i18n.t(lang, exception.i18nKey, exception.i18nArgs);
      code = this.statusToCode(status);
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
    }

    if (status >= 500 || !(exception instanceof HttpException)) {
      this.logger.error(
        'Unhandled exception',
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const traceId = crypto.randomUUID();
    const body: ApiResponse<null> = {
      success: false,
      code,
      msg: message as string,
      traceId,
      data: null,
    };

    response.status(status).json(body);
  }

  private statusToCode(status: number): ErrorCode {
    switch (status) {
      case 400: return 'BAD_REQUEST';
      case 401: return 'UNAUTHORIZED';
      case 403: return 'FORBIDDEN';
      case 404: return 'NOT_FOUND';
      case 409: return 'CONFLICT';
      default: return 'INTERNAL_ERROR';
    }
  }
}
