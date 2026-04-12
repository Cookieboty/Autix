import { useEffect, useRef, useCallback } from 'react';
import { TaskEvent } from '../lib/api';

// 直接连接后端，绕过 Next.js rewrites 代理（Next.js 对 SSE 长连接存在缓冲/超时问题）
const SSE_PATH = `${process.env.NEXT_PUBLIC_CHAT_API_URL ?? 'http://localhost:4001'}/api/sse/tasks`;

export function useTaskEvents(
  onEvent: (event: TaskEvent) => void,
  options?: { onConnected?: () => void }
) {
  const sourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEventRef = useRef(onEvent);
  const onConnectedRef = useRef(options?.onConnected);

  // Keep refs current so closures inside connect() always call the latest callbacks
  onEventRef.current = onEvent;
  onConnectedRef.current = options?.onConnected;

  const connect = useCallback(() => {
    const token = localStorage.getItem('accessToken');
    const url = token ? `${SSE_PATH}?token=${encodeURIComponent(token)}` : SSE_PATH;

    const source = new EventSource(url);
    sourceRef.current = source;

    source.addEventListener('task', (e) => {
      try {
        const event: TaskEvent = JSON.parse(e.data);
        onEventRef.current(event);
      } catch {
        console.error('[useTaskEvents] failed to parse event data');
      }
    });

    source.addEventListener('connected', () => {
      onConnectedRef.current?.();
    });

    source.onerror = () => {
      console.warn('[useTaskEvents] SSE error, reconnecting in 3s...');
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      source.close();
      sourceRef.current = null;
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      sourceRef.current?.close();
    };
  }, [connect]);
}
