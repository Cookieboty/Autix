import { randomUUID } from 'node:crypto';
import { AppLogger } from './app-logger';
import { TraceContext } from './trace-context';

/**
 * 后台任务包裹结果。业务回调可选择返回其中之一：
 * - 不返回（`void`/`undefined`）：wrapper 静默完成，不额外打 done 日志——沿用既有
 *   "无工作不打印"策略，也让原本 catch 掉异常的 Cron 保持行为一致。
 * - `{ noop: true }`：显式声明本次没有工作，done 走 `debug`（避免每 30s 空跑刷 info）。
 * - `{ changed: N, slowMs? }`：显式声明发生了业务变更，done 走 `info` 并携带数量。
 *   如果 `slowMs` 传入且 elapsedMs 超过它，也升级到 warn。
 * - `{ failed: true, error?, reason? }`：业务已经 catch 掉异常但语义是失败——
 *   这条通道解决评审 P1-2：让 wrapper 能感知失败而不是误报 done。
 */
export type JobOutcome =
  | void
  | { noop: true }
  | { changed: number; slowMs?: number }
  | { failed: true; error?: unknown; reason?: string };

/**
 * 后台任务（@Cron / @Interval / queue consumer）统一 trace + 日志包装器。
 *
 * 为什么需要：
 * - Cron 没有请求上下文，AppLogger 无法自动附加 traceId，日志就"裸奔"了。
 * - 手工在每个 Cron 里 `TraceContext.run(...)` 太散乱，容易漏。
 *
 * 语义（评审后修订）：
 * - start：一律 `debug`，避免每次调度都产生 2 条 info（视频轮询 30s/次 × 空跑 =
 *   5760 条/天/实例，会淹没真正的信号）。
 * - done：只有业务显式声明有工作（`{ changed }`）或失败（`{ failed }`/抛异常）时
 *   才走 info/error；返回 `{ noop: true }` 或不返回值时不打 info。
 * - failed：既支持"抛异常"，也支持业务已在内部 catch 后返回 `{ failed: true }`——
 *   这是评审 P1-2 明确要求的通道，用于把订单/积分/风控等 catch 吞异常的任务导入
 *   真实的失败告警口径。
 */
export async function runInJobContext<T extends JobOutcome>(
  options: {
    /** 简短的任务名，会作为 traceId 前缀，如 `job-points.holdReclaim-xxx`。 */
    name: string;
    /** 用于打生命周期日志的 logger；不传则不打，业务自行记录。 */
    logger?: AppLogger;
  },
  fn: () => Promise<T>,
): Promise<T> {
  const jobId = `job-${options.name}-${randomUUID()}`;
  const startedAt = Date.now();

  return TraceContext.run(
    {
      traceId: jobId,
      method: 'JOB',
      url: options.name,
      startedAt,
    },
    async () => {
      // start 用 debug：避免每次调度都刷 info（原评审 P2 的空跑噪声）。
      options.logger?.debug?.(`job start: ${options.name}`);
      try {
        const result = await fn();
        const elapsedMs = Date.now() - startedAt;

        if (result && typeof result === 'object') {
          if ('failed' in result && result.failed) {
            const reason =
              result.reason ??
              (result.error instanceof Error
                ? result.error.message
                : result.error !== undefined
                  ? String(result.error)
                  : 'unknown');
            options.logger?.error?.(
              `job failed: ${options.name} elapsedMs=${elapsedMs} err=${reason}`,
              result.error instanceof Error ? result.error.stack : undefined,
            );
          } else if ('changed' in result) {
            const slowMs = result.slowMs ?? 0;
            const suffix = ` changed=${result.changed} elapsedMs=${elapsedMs}`;
            if (slowMs > 0 && elapsedMs >= slowMs) {
              options.logger?.warn?.(
                `job slow: ${options.name}${suffix}`,
              );
            } else {
              options.logger?.log?.(`job done: ${options.name}${suffix}`);
            }
          } else if ('noop' in result && result.noop) {
            options.logger?.debug?.(
              `job noop: ${options.name} elapsedMs=${elapsedMs}`,
            );
          }
        }
        // result 为 void/undefined 时 wrapper 保持静默：业务自负日志（保持既有低噪声约束）。

        return result;
      } catch (err) {
        options.logger?.error?.(
          `job failed: ${options.name} elapsedMs=${Date.now() - startedAt} err=${
            err instanceof Error ? err.message : String(err)
          }`,
          err instanceof Error ? err.stack : undefined,
        );
        throw err;
      }
    },
  );
}
