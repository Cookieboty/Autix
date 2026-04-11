'use client';

import { useCallback, useEffect } from 'react';
import { useTaskEvents } from '@/hooks/useTaskEvents';
import { useTaskStore } from '@/store/task.store';
import { useToast } from '@heroui/react';

function TaskSseProviderInner({ children }: { children: React.ReactNode }) {
  const addEvent = useTaskStore((s) => s.addEvent);
  const setConnected = useTaskStore((s) => s.setConnected);
  const loadHistory = useTaskStore((s) => s.loadHistory);
  const { toast } = useToast();

  const handleEvent = useCallback(
    (event: Parameters<typeof addEvent>[0]) => {
      addEvent(event);

      if (event.status === 'done') {
        toast({
          color: 'success',
          title: '任务完成',
          description: event.message,
          timeout: 3000,
        });
      } else if (event.status === 'error') {
        toast({
          color: 'danger',
          title: '任务失败',
          description: event.message,
          timeout: 0,
        });
      }
    },
    [addEvent, toast]
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
