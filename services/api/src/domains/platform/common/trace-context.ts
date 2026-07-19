import { AsyncLocalStorage } from 'node:async_hooks';

export interface TraceStore {
  /** 单次 HTTP 请求（或后台任务批次）的唯一 ID。对应响应头 X-Request-Id。 */
  traceId: string;
  /**
   * 关联多次请求的会话 ID（可选）。对应请求/响应头 X-Correlation-Id。
   * 用于把一次用户动作触发的多次 HTTP 请求（如前端轮询会话、SDK 401 重试）串联起来。
   */
  correlationId?: string;
  method?: string;
  url?: string;
  userId?: string;
  startedAt: number;
}

const storage = new AsyncLocalStorage<TraceStore>();

export const TraceContext = {
  run<T>(store: TraceStore, fn: () => T): T {
    return storage.run(store, fn);
  },

  getStore(): TraceStore | undefined {
    return storage.getStore();
  },

  getTraceId(): string | undefined {
    return storage.getStore()?.traceId;
  },

  getCorrelationId(): string | undefined {
    return storage.getStore()?.correlationId;
  },

  setUserId(userId: string): void {
    const store = storage.getStore();
    if (store) store.userId = userId;
  },
};
