import { useEffect, useRef, useCallback } from 'react';
import { TaskEvent } from '../lib/api';

const SSE_PATH = '/api/sse/tasks';

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
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
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
