import { getStorage } from '@autix/platform';
import { telemetryApi, type ResourceViewEventInput } from '@autix/sdk';
import { useAuthStore } from './auth.store';

/**
 * 浏览量（PV/UV）前端上报器。
 *
 * 后端链路（telemetry → resource_view_events/resource_uv_days → cron aggregateDaily →
 * resource_metrics.{pvCount,uvCount,viewCount}）本就建好，缺的只是前端这一环。
 *
 * 设计要点：
 * - **best-effort**：任何失败静默吞掉，绝不影响页面。
 * - **缓冲 + 去抖**：同一 (resourceType,resourceId,scope) 在缓冲里去重，攒一小批一起发；
 *   后端本身还按分钟(PV)/天(UV)去重，重复上报无害。
 * - **身份**：登录带 userId，匿名带持久化的 visitorId（UV 去重靠它）。
 * - **兜底 flush**：页面切到后台 / 卸载时把缓冲里剩的发出去。
 */

const VISITOR_ID_KEY = 'autix.visitorId';
const FLUSH_DELAY_MS = 3000;
const MAX_BUFFER = 20;

let visitorIdPromise: Promise<string> | null = null;

function newVisitorId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
}

/** 读取或生成匿名访客 id，持久化到平台存储（web=localStorage）。只解析一次并缓存 promise。 */
function ensureVisitorId(): Promise<string> {
  if (visitorIdPromise) return visitorIdPromise;
  visitorIdPromise = (async () => {
    try {
      const storage = getStorage();
      const existing = await storage.getItem(VISITOR_ID_KEY);
      if (existing) return existing;
      const id = newVisitorId();
      await storage.setItem(VISITOR_ID_KEY, id);
      return id;
    } catch {
      // 存储不可用（隐私模式等）：退化为一次性内存 id，仍能让本会话 UV 去重成立。
      return newVisitorId();
    }
  })();
  return visitorIdPromise;
}

const buffer = new Map<string, ResourceViewEventInput>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function flush(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (buffer.size === 0) return;
  const events = [...buffer.values()];
  buffer.clear();
  try {
    await telemetryApi.reportResourceViews(events);
  } catch {
    // best-effort：丢弃即可，浏览量非关键数据，不重试不回灌缓冲
  }
}

function scheduleFlush(): void {
  if (buffer.size >= MAX_BUFFER) {
    void flush();
    return;
  }
  if (flushTimer) return;
  flushTimer = setTimeout(() => void flush(), FLUSH_DELAY_MS);
}

let lifecycleBound = false;
function bindLifecycleFlush(): void {
  if (lifecycleBound || typeof window === 'undefined') return;
  lifecycleBound = true;
  // 页面切后台/卸载时把缓冲里剩的发掉。visibilitychange(hidden) 在移动端/切标签页可靠触发，
  // 且此时页面仍存活，普通 fetch 能发出去；pagehide 作为二次兜底。
  const onHide = () => void flush();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') onHide();
  });
  window.addEventListener('pagehide', onHide);
}

/**
 * 上报一次浏览。scope='detail' 喂 viewCount（卡片显示的「访问量」）+ pvCount + uvCount；
 * scope='list' 喂 pvCount（列表曝光）。SSR/无 window 时直接跳过。
 */
export function reportResourceView(input: {
  resourceType: string;
  resourceId: string;
  scope: ResourceViewEventInput['scope'];
}): void {
  if (typeof window === 'undefined' || !input.resourceId) return;
  bindLifecycleFlush();
  void (async () => {
    const userId = useAuthStore.getState().user?.id ?? null;
    const visitorId = userId ? null : await ensureVisitorId();
    const key = `${input.resourceType}|${input.resourceId}|${input.scope}`;
    buffer.set(key, {
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      scope: input.scope,
      userId,
      visitorId,
    });
    scheduleFlush();
  })();
}

export const telemetryActions = {
  reportResourceView,
  /** 立即发送缓冲（一般不用手动调，供测试或特殊时机）。 */
  flushResourceViews: flush,
};
