'use client';

import { useEffect, useState } from 'react';

/**
 * 检测当前是否运行在 Electron 桌面端。
 * - 优先看 window.amux(预期 preload 注入的资源安装能力)
 * - 退化看 navigator.userAgent.includes('Electron')
 */
export function useIsElectron(): boolean {
  const [isElectron, setIsElectron] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hasAmux = !!(window as unknown as { amux?: unknown }).amux;
    const ua =
      typeof navigator !== 'undefined'
        ? navigator.userAgent.toLowerCase()
        : '';
    setIsElectron(hasAmux || ua.includes('electron'));
  }, []);
  return isElectron;
}
