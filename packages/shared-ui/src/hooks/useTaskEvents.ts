'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import {
  authFetchEventSource,
  getApiUrl,
  type TaskEvent,
} from '@autix/shared-store';
import { getAuth } from '@autix/platform';

export function useTaskEvents(
  onEvent: (event: TaskEvent) => void,
  options?: { onConnected?: () => void },
) {
  const abortRef = useRef<AbortController | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEventRef = useRef(onEvent);
  const onConnectedRef = useRef(options?.onConnected);
  // 每次 effect cleanup 时自增；所有 in-flight 回调通过比对 epoch 自动作废，
  // 防止组件卸载后 onerror 仍 schedule 出 zombie 重连。
  const epochRef = useRef(0);
  const [hasToken, setHasToken] = useState(false);

  onEventRef.current = onEvent;
  onConnectedRef.current = options?.onConnected;

  useEffect(() => {
    let cancelled = false;
    const checkToken = async () => {
      const token = await getAuth().getAccessToken();
      if (cancelled) return;
      setHasToken((prev) => (prev === !!token ? prev : !!token));
    };
    void checkToken();
    const interval = setInterval(checkToken, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const connect = useCallback(async () => {
    const myEpoch = epochRef.current;

    const token = await getAuth().getAccessToken();
    if (!token || myEpoch !== epochRef.current) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const ssePath = getApiUrl('/api/sse/tasks');

    authFetchEventSource(ssePath, {
      signal: ctrl.signal,
      onopen: async (res) => {
        if (myEpoch !== epochRef.current) return;
        if (res.ok) {
          onConnectedRef.current?.();
          return;
        }
        throw new Error(`SSE open failed: ${res.status}`);
      },
      onmessage: (ev) => {
        if (myEpoch !== epochRef.current) return;
        if (ev.event === 'task') {
          try {
            const event: TaskEvent = JSON.parse(ev.data);
            onEventRef.current(event);
          } catch {
            // 解析失败静默
          }
        }
        if (ev.event === 'connected') {
          onConnectedRef.current?.();
        }
      },
      onerror: (err) => {
        ctrl.abort();
        // 当前 effect 已 cleanup → 不再重连，throw 让 fetch-event-source 停止默认重连。
        if (myEpoch !== epochRef.current) throw err;
        reconnectTimeoutRef.current = setTimeout(() => {
          if (myEpoch === epochRef.current) void connect();
        }, 3000);
        throw err;
      },
      openWhenHidden: true,
    });
  }, []);

  useEffect(() => {
    if (hasToken) void connect();

    return () => {
      epochRef.current += 1;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [connect, hasToken]);
}
