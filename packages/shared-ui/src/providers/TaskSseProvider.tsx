'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { getDocuments } from '@autix/shared-lib';
import { useTaskEvents } from '../hooks/useTaskEvents';
import { useDocumentStore } from '@autix/shared-store';
import { useTaskStore } from '@autix/shared-store';
import { toast } from 'sonner';

function TaskSseProviderInner({ children }: { children: React.ReactNode }) {
  const t = useTranslations('common');
  const addEvent = useTaskStore((s) => s.addEvent);
  const setConnected = useTaskStore((s) => s.setConnected);
  const loadHistory = useTaskStore((s) => s.loadHistory);
  const setDocuments = useDocumentStore((s) => s.setDocuments);

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

      if (event.status === 'done') {
        toast.success(event.message ?? t('taskCompleted'), { duration: 3000 });
      } else if (event.status === 'error') {
        toast.error(event.message ?? t('taskFailed'));
      }
    },
    [addEvent, refreshDocuments]
  );

  const handleConnected = useCallback(() => {
    setConnected(true);
    loadHistory();
  }, [setConnected, loadHistory]);

  useTaskEvents(handleEvent, { onConnected: handleConnected });

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return <>{children}</>;
}

export { TaskSseProviderInner as TaskSseProvider };
