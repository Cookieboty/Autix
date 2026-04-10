import { useEffect, useRef, useCallback } from 'react';
import { getTaskHistory, TaskEvent } from '../lib/api';

const SSE_URL = '/api/sse/tasks';

export function useTaskEvents(onEvent: (event: TaskEvent) => void) {
  const sourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    const source = new EventSource(SSE_URL);
    sourceRef.current = source;

    source.addEventListener('task', (e) => {
      try {
        const event: TaskEvent = JSON.parse(e.data);
        onEvent(event);
      } catch {
        console.error('[useTaskEvents] failed to parse event data');
      }
    });

    source.addEventListener('connected', () => {
      console.log('[useTaskEvents] connected');
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
  }, [onEvent]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      sourceRef.current?.close();
    };
  }, [connect]);

  const fetchHistory = useCallback(
    async (params?: { page?: number; pageSize?: number; taskType?: string }) => {
      const result = await getTaskHistory(params);
      return result.data;
    },
    [],
  );

  return { fetchHistory };
}
