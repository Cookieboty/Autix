'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { type TaskEvent, getAuth, getEnv, getNavigation } from '@autix/shared-lib';

class FatalError extends Error {}

export function useTaskEvents(
  onEvent: (event: TaskEvent) => void,
  options?: { onConnected?: () => void },
) {
  const abortRef = useRef<AbortController | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEventRef = useRef(onEvent);
  const onConnectedRef = useRef(options?.onConnected);
  const [hasToken, setHasToken] = useState(false);

  onEventRef.current = onEvent;
  onConnectedRef.current = options?.onConnected;

  useEffect(() => {
    let cancelled = false;
    const checkToken = async () => {
      const token = await getAuth().getAccessToken();
      if (!cancelled) setHasToken(!!token);
    };
    checkToken();
    const interval = setInterval(checkToken, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const connect = useCallback(async () => {
    const token = await getAuth().getAccessToken();
    if (!token) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const ssePath = `${getEnv().chatApiUrl}/api/sse/tasks`;

    fetchEventSource(ssePath, {
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${token}` },
      onopen: async (res) => {
        if (res.ok) {
          onConnectedRef.current?.();
          return;
        }
        if (res.status === 401 || res.status === 403) {
          throw new FatalError(`HTTP ${res.status}`);
        }
        throw new Error(`SSE open failed: ${res.status}`);
      },
      onmessage: (ev) => {
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
        if (err instanceof FatalError) {
          getAuth().clearTokens();
          getNavigation().push('/login');
          throw err;
        }
        ctrl.abort();
        getAuth().getAccessToken().then((t) => {
          if (t) reconnectTimeoutRef.current = setTimeout(() => void connect(), 3000);
        });
        throw err;
      },
      openWhenHidden: true,
    });
  }, []);

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (hasToken) {
      void connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      abortRef.current?.abort();
    };
  }, [connect, hasToken]);
}
