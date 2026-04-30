import { useEffect, useRef, useCallback, useState } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { TaskEvent } from '../lib/api';
import { clearAuth } from '@/lib/auth';

const SSE_PATH = `${process.env.NEXT_PUBLIC_CHAT_API_URL ?? 'http://localhost:4001'}/api/sse/tasks`;

class FatalError extends Error {}

export function useTaskEvents(
  onEvent: (event: TaskEvent) => void,
  options?: { onConnected?: () => void }
) {
  const abortRef = useRef<AbortController | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEventRef = useRef(onEvent);
  const onConnectedRef = useRef(options?.onConnected);
  const [hasToken, setHasToken] = useState(false);

  onEventRef.current = onEvent;
  onConnectedRef.current = options?.onConnected;

  useEffect(() => {
    const checkToken = () => {
      const token = localStorage.getItem('accessToken');
      setHasToken(!!token);
    };

    checkToken();
    window.addEventListener('storage', checkToken);
    const interval = setInterval(checkToken, 1000);

    return () => {
      window.removeEventListener('storage', checkToken);
      clearInterval(interval);
    };
  }, []);

  const connect = useCallback(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    fetchEventSource(SSE_PATH, {
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
            console.error('[useTaskEvents] failed to parse event data');
          }
        }
        if (ev.event === 'connected') {
          onConnectedRef.current?.();
        }
      },
      onerror: (err) => {
        if (err instanceof FatalError) {
          console.warn('[useTaskEvents] auth failed, redirecting to login');
          clearAuth();
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
          throw err;
        }
        console.warn('[useTaskEvents] SSE error, reconnecting in 3s...');
        ctrl.abort();
        if (localStorage.getItem('accessToken')) {
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        }
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
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      abortRef.current?.abort();
    };
  }, [connect, hasToken]);
}
