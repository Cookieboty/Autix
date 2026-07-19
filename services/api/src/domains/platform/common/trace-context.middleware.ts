import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { TraceContext } from './trace-context';

const HEADER_NAME = 'x-request-id';
const CORRELATION_HEADER = 'x-correlation-id';
const RESPONSE_HEADER = 'X-Request-Id';
const RESPONSE_CORRELATION_HEADER = 'X-Correlation-Id';
const TRACE_ID_PATTERN = /^[a-zA-Z0-9._-]{8,128}$/;

function pickHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function sanitize(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return TRACE_ID_PATTERN.test(raw) ? raw : undefined;
}

@Injectable()
export class TraceContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // main.ts 的 traceContextBootstrap 已经在 body parser 之前建立了上下文；
    // 这里检测到已有上下文时直接透传，避免二次覆盖 traceId。
    const existing = TraceContext.getStore();
    if (existing) {
      return next();
    }

    const incomingRequestId = sanitize(pickHeader(req.headers[HEADER_NAME]));
    const incomingCorrelationId = sanitize(pickHeader(req.headers[CORRELATION_HEADER]));

    const traceId = incomingRequestId ?? randomUUID();
    const correlationId = incomingCorrelationId;

    res.setHeader(RESPONSE_HEADER, traceId);
    if (correlationId) {
      res.setHeader(RESPONSE_CORRELATION_HEADER, correlationId);
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
  }
}
