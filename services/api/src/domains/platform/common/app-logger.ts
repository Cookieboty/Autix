import { Logger, LogLevel } from '@nestjs/common';
import { TraceContext } from './trace-context';

/**
 * 给日志消息加上追踪前缀：
 * - [trace=<traceId>]：单次请求/后台任务批次的唯一 ID（等同响应头 X-Request-Id）。
 * - [corr=<correlationId>]：可选，会话级 ID（等同 X-Correlation-Id），用于把一次用户
 *   动作触发的多次 HTTP 请求（如前端轮询）在服务端日志里聚合起来。
 *
 * 只有 traceId 存在时才走前缀路径；只带 correlationId 而无 traceId 的情况不会发生
 * （TraceContext.run 强制要求 traceId）。
 */
function prefixWithTrace(message: unknown): unknown {
  const traceId = TraceContext.getTraceId();
  if (!traceId) return message;
  if (typeof message !== 'string') return message;
  const correlationId = TraceContext.getCorrelationId();
  return correlationId
    ? `[trace=${traceId}] [corr=${correlationId}] ${message}`
    : `[trace=${traceId}] ${message}`;
}

export class AppLogger extends Logger {
  log(message: unknown, ...optionalParams: unknown[]): void {
    super.log(prefixWithTrace(message) as never, ...(optionalParams as never[]));
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    super.error(prefixWithTrace(message) as never, ...(optionalParams as never[]));
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    super.warn(prefixWithTrace(message) as never, ...(optionalParams as never[]));
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    super.debug(prefixWithTrace(message) as never, ...(optionalParams as never[]));
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    super.verbose(prefixWithTrace(message) as never, ...(optionalParams as never[]));
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    super.fatal(prefixWithTrace(message) as never, ...(optionalParams as never[]));
  }

  static isLevelEnabled(level: LogLevel): boolean {
    return Logger.isLevelEnabled(level);
  }
}
