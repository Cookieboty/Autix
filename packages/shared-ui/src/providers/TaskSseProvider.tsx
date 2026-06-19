'use client';

import { useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useTaskEvents } from '../hooks/useTaskEvents';
import { useLibraryEnabled } from '../hooks/useModelConfigEnabled';
import { useDocumentStore } from '@autix/shared-store';
import { useTaskStore } from '@autix/shared-store';
import { toast } from 'sonner';

function TaskSseProviderInner({ children }: { children: React.ReactNode }) {
  const t = useTranslations('common');
  const addEvent = useTaskStore((s) => s.addEvent);
  const setConnected = useTaskStore((s) => s.setConnected);
  const loadHistory = useTaskStore((s) => s.loadHistory);
  const refreshDocumentStore = useDocumentStore((s) => s.refreshDocuments);
  const libraryEnabled = useLibraryEnabled(false);

  const refreshDocuments = useCallback(async () => {
    if (!libraryEnabled) return;
    try {
      await refreshDocumentStore();
    } catch (err) {
      console.error('[TaskSseProvider] refreshDocuments failed:', err);
    }
  }, [libraryEnabled, refreshDocumentStore]);

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
