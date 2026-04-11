'use client';

import { useCallback, useEffect } from 'react';
import { useTaskEvents } from '@/hooks/useTaskEvents';
import { useTaskStore } from '@/store/task.store';
import { toast } from '@heroui/react';

function TaskSseProviderInner({ children }: { children: React.ReactNode }) {
  const addEvent = useTaskStore((s) => s.addEvent);
  const setConnected = useTaskStore((s) => s.setConnected);
  const loadHistory = useTaskStore((s) => s.loadHistory);

  const handleEvent = useCallback(
    (event: Parameters<typeof addEvent>[0]) => {
      addEvent(event);

      if (event.status === 'done') {
        toast.success(event.message ?? '任务完成', { timeout: 3000 });
      } else if (event.status === 'error') {
        toast.danger(event.message ?? '任务失败', { timeout: 0 });
      }
    },
    [addEvent]
  );

  const handleConnected = useCallback(() => {
    setConnected(true);
  }, [setConnected]);

  useTaskEvents(handleEvent, { onConnected: handleConnected });

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return <>{children}</>;
}

export { TaskSseProviderInner as TaskSseProvider };
