import { useEffect, useRef, useCallback, useState } from 'react';
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
  const [hasToken, setHasToken] = useState(false);

  // Keep refs current so closures inside connect() always call the latest callbacks
  onEventRef.current = onEvent;
  onConnectedRef.current = options?.onConnected;

  // 检查 token 是否存在
  useEffect(() => {
    const checkToken = () => {
      const token = localStorage.getItem('accessToken');
      setHasToken(!!token);
    };

    // 初始检查
    checkToken();

    // 监听 storage 事件（跨标签页同步）
    window.addEventListener('storage', checkToken);

    // 定期检查（处理同一标签页内的 token 变化）
    const interval = setInterval(checkToken, 1000);

    return () => {
      window.removeEventListener('storage', checkToken);
      clearInterval(interval);
    };
  }, []);

  const connect = useCallback(() => {
    const token = localStorage.getItem('accessToken');
    
    // 如果没有 token，不建立连接
    if (!token) {
      console.log('[useTaskEvents] No token found, skipping SSE connection');
      return;
    }

    const url = `${SSE_PATH}?token=${encodeURIComponent(token)}`;

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
      
      // 只有在有 token 时才重连
      if (localStorage.getItem('accessToken')) {
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      }
    };
  }, []);

  useEffect(() => {
    // 清理之前的连接
    if (sourceRef.current) {
      sourceRef.current.close();
      sourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // 只有在有 token 时才建立连接
    if (hasToken) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      sourceRef.current?.close();
    };
  }, [connect, hasToken]);
}
