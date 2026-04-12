'use client';

import { useCallback, useEffect, useRef } from 'react';
import { getDocuments } from '@/lib/api';
import { useTaskEvents } from '@/hooks/useTaskEvents';
import { useDocumentStore } from '@/store/document.store';
import { useTaskStore } from '@/store/task.store';

interface ToastModule {
  toast: {
    success(message: string, options?: { timeout?: number }): string;
    danger(message: string, options?: { timeout?: number }): string;
  };
}

function TaskSseProviderInner({ children }: { children: React.ReactNode }) {
  const addEvent = useTaskStore((s) => s.addEvent);
  const setConnected = useTaskStore((s) => s.setConnected);
  const loadHistory = useTaskStore((s) => s.loadHistory);
  const setDocuments = useDocumentStore((s) => s.setDocuments);
  const toastModuleRef = useRef<ToastModule['toast'] | null>(null);

  useEffect(() => {
    import('@heroui/react').then((mod) => {
      toastModuleRef.current = (mod as any).toast;
    });
  }, []);

  const refreshDocuments = useCallback(async () => {
    try {
      const { data } = await getDocuments();
      setDocuments(data);
    } catch (err) {
      console.error('[TaskSseProvider] refreshDocuments failed:', err);
    }
  }, [setDocuments]);

  const handleEvent = useCallback(
    (event: Parameters<typeof addEvent>[0]) => {
      addEvent(event);

      if (
        event.taskType === 'document_vectorize' &&
        (event.status === 'done' || event.status === 'error')
      ) {
        void refreshDocuments();
      }

      const toastFn = toastModuleRef.current;
      if (!toastFn) return;

      if (event.status === 'done') {
        toastFn.success(event.message ?? '任务完成', { timeout: 3000 });
      } else if (event.status === 'error') {
        toastFn.danger(event.message ?? '任务失败', { timeout: 0 });
      }
    },
    [addEvent, refreshDocuments]
  );

  const handleConnected = useCallback(() => {
    setConnected(true);
    // 每次重连都重拉历史，补回断线期间丢失的事件
    loadHistory();
  }, [setConnected, loadHistory]);

  useTaskEvents(handleEvent, { onConnected: handleConnected });

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return <>{children}</>;
}

export { TaskSseProviderInner as TaskSseProvider };
