'use client';

import { useEffect } from 'react';

/**
 * SSE 韧性增强：监听网络变化、电源恢复、窗口聚焦等事件，触发回调让消费方重连。
 *
 * 桌面端的 powerMonitor.on('resume') 信号通过主进程 → IPC 转发到这里。
 * 当前实现仅监听浏览器层的 online/visibilitychange 事件；后续可加 IPC 通道。
 */
export function useSSEReconnect(reconnect: () => void): void {
  useEffect(() => {
    const handleOnline = () => reconnect();
    const handleVisible = () => {
      if (document.visibilityState === 'visible') reconnect();
    };
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisible);
    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisible);
    };
  }, [reconnect]);
}
