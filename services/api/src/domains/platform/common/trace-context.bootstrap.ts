import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { TraceContext } from './trace-context';

const REQUEST_ID_HEADER = 'x-request-id';
const CORRELATION_ID_HEADER = 'x-correlation-id';
const RESPONSE_REQUEST_ID = 'X-Request-Id';
const RESPONSE_CORRELATION_ID = 'X-Correlation-Id';
const ID_PATTERN = /^[a-zA-Z0-9._-]{8,128}$/;

function pickHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function sanitize(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return ID_PATTERN.test(raw) ? raw : undefined;
}

/**
 * 顶层 trace bootstrap：必须在 body parser、helmet、CORS 之前挂载，
 * 覆盖 JSON parser 抛错、payload 超限、CORS 预检失败等一切早期错误路径。
 *
 * Nest 内的 TraceContextMiddleware 会检测已存在的上下文并复用同一 traceId，
 * 避免二次覆盖。
 */
export function createTraceContextBootstrap() {
  return function traceContextBootstrap(req: Request, res: Response, next: NextFunction): void {
    const incomingRequestId = sanitize(pickHeader(req.headers[REQUEST_ID_HEADER]));
    const incomingCorrelationId = sanitize(pickHeader(req.headers[CORRELATION_ID_HEADER]));

    // request ID = 单次 HTTP 粒度。客户端带了合法值就复用——SDK 每请求自生成一个
    // （client-core.ts），复用才能把客户端日志和服务端日志按同一 ID join 起来。
    // 代价：traceId 是客户端可控输入，任何调用方都能把自己的多个请求钉成同一个 ID。
    // 可接受，因为 traceId 只用于日志关联，不参与鉴权/限流/计费等任何决策；
    // 若将来有逻辑要基于它做判断，必须改成服务端强制新生成。
    const traceId = incomingRequestId ?? randomUUID();
    const correlationId = incomingCorrelationId;

    res.setHeader(RESPONSE_REQUEST_ID, traceId);
    if (correlationId) {
      res.setHeader(RESPONSE_CORRELATION_ID, correlationId);
    }

    TraceContext.run(
      {
        traceId,
        correlationId,
        method: req.method,
        url: req.originalUrl ?? req.url,
        startedAt: Date.now(),
      },
      () => next(),
    );
  };
}
