import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppLogger } from './app-logger';
import { Request, Response } from 'express';
import type { ApiResponse, ApiResponseHint, ErrorCode } from '@autix/domain';
import { I18nService } from '../i18n/i18n.service';
import { I18nHttpException } from '../i18n/i18n-http.exception';
import { DEFAULT_LANGUAGE } from '@autix/i18n';
import { TraceContext } from './trace-context';

type LocalizedRequest = Request & { lang?: string };
type HttpExceptionResponse = {
  message?: string | string[];
  code?: string;
  hint?: ApiResponseHint;
  retryAfterMs?: number;
  /** 可选的结构化错误上下文。 */
  data?: unknown;
};

/**
 * body-parser / raw-body / http-errors 抛出的错误：结构是 `{ status, statusCode, message,
 * type, expose }`，不是 HttpException 子类。若不识别就会全部 500，早期错误的 4xx 语义
 * 就丢了（评审 P3：413 payload 超限、非法 JSON 都属于这一类）。
 *
 * 判断范围必须收紧（评审 P2）：早期实现只检查 `status/statusCode + message`，会把任意
 * 携带 `status: 404` 字段的第三方 SDK 异常也当成客户端 HTTP 错误处理——原始 message
 * 会直接暴露给客户端、被跳过 error 日志。这里改为以下全部满足才识别：
 *   1) `exception instanceof Error`（排除普通对象、上游 axios/fetch response 结构）。
 *   2) `status` 是 4xx/5xx **整数**（排除字符串状态或非法值）。
 *   3) `expose === true`：http-errors 只对"消息可安全暴露给客户端"的错误设置此位。
 *   4) `type` 命中已知的 body-parser/raw-body 类别白名单，避免第三方错误碰巧同名。
 * 任一条件不满足就落回 500 兜底路径，同时保留 error 日志。
 */
const KNOWN_BODY_PARSER_ERROR_TYPES = new Set<string>([
  // body-parser 的稳定 type，来自其 README / 源码（json.js / urlencoded.js / read.js）。
  'entity.parse.failed',
  'entity.verify.failed',
  'entity.too.large',
  'request.aborted',
  'request.size.invalid',
  'stream.encoding.set',
  'stream.not.readable',
  'parameters.too.many',
  'charset.unsupported',
  'encoding.unsupported',
]);

interface BodyParserErrorLike extends Error {
  status: number;
  statusCode?: number;
  type: string;
  expose: true;
}

function isHttpErrorLike(exception: unknown): exception is BodyParserErrorLike {
  if (!(exception instanceof Error)) return false;
  const anyErr = exception as unknown as Record<string, unknown>;
  const status = anyErr.status ?? anyErr.statusCode;
  if (
    typeof status !== 'number' ||
    !Number.isInteger(status) ||
    status < 400 ||
    status >= 600
  ) {
    return false;
  }
  if (anyErr.expose !== true) return false;
  const type = anyErr.type;
  if (typeof type !== 'string' || !KNOWN_BODY_PARSER_ERROR_TYPES.has(type)) {
    return false;
  }
  return true;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new AppLogger(AllExceptionsFilter.name);

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
      // retryAfterMs 是稳定 envelope 字段；限流类翻译错误（如 throttler 出口）会带上，
      // 供前端做退避展示，语义与普通 HttpException 分支一致。
      retryAfterMs = exception.retryAfterMs;
      // data 用于翻译型异常携带结构化上下文（如 DTO 校验的 violations 列表）：
      // 文案仍由 i18nKey 翻译，参数走 data，避免把动态值拼进 msg 破坏国际化。
      if (exception.data !== undefined) payloadData = exception.data;
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
    } else if (isHttpErrorLike(exception)) {
      // body-parser（非法 JSON → 400、PayloadTooLarge → 413）等 http-errors 会走这里，
      // 否则会被误判为 500，早期 4xx 语义丢失（评审 P3）。
      status = exception.status;
      message = exception.message;
      code = this.statusToCode(status);
    }

    // 先算 traceId 再写 error 日志：上下文缺失时 wrapper 会生成 err-<uuid> 兜底 ID，
    // 但如果先打日志再算 ID，那条 error 就没这个 ID，响应体和日志就无法互相关联
    // （评审 P2）。这里把 ID 塞进 error 消息里，保证同一个字符串一定出现在两侧。
    const traceId = TraceContext.getTraceId() ?? `err-${randomUUID()}`;

    // 何时打 error 日志：
    // - status >= 500：真正的服务端异常，必须记录。
    // - 完全未识别的异常（不是 HttpException 也不是 http-errors）：兜底 500 语义，也记录。
    // 但 body-parser 400/413 等 http-errors 属于客户端错误，不再当"未捕获异常"打 error。
    if (
      status >= 500 ||
      (!(exception instanceof HttpException) && !isHttpErrorLike(exception))
    ) {
      this.logger.error(
        `Unhandled exception traceId=${traceId}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    // 兜底 traceId 也写到响应头，保证前端/网关能读到；正常路径下 middleware 已设置过，
    // 这里覆写等价，异常路径下才第一次写入。
    if (!response.headersSent) {
      response.setHeader('X-Request-Id', traceId);
      const correlationId = TraceContext.getCorrelationId();
      if (correlationId) response.setHeader('X-Correlation-Id', correlationId);
    }
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
      case 413: return 'PAYLOAD_TOO_LARGE';
      case 429: return 'TOO_MANY_REQUESTS';
      default: return 'INTERNAL_ERROR';
    }
  }
}
