'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SidebarTrigger } from '@autix/shared-ui/ui';
import { useLibraryEnabled } from '@autix/shared-ui/hooks';
import { useTaskStore, TaskEvent } from '@/store/task.store';
import { markTaskRead } from '@/lib/api';
import { relativeTime } from '@/lib/utils';

type Tab = 'all' | 'unread';

const STATUS_COLOR: Record<string, string> = {
  processing: 'var(--brand)',
  done: 'var(--success)',
  error: 'var(--danger)',
};

const STATUS_LABEL_KEYS: Record<string, string> = {
  processing: 'statusProcessing',
  done: 'statusDone',
  error: 'statusError',
};

export default function NotificationsPage() {
  const t = useTranslations('notification');
  const router = useRouter();
  const libraryEnabled = useLibraryEnabled(false);
  const events = useTaskStore((s) => s.events);
  const markRead = useTaskStore((s) => s.markRead);
  const [tab, setTab] = useState<Tab>('all');
  const [loading, setLoading] = useState<string | null>(null);

  const filtered = tab === 'unread' ? events.filter((e) => !e.readAt) : events;

  const handleItemClick = async (event: TaskEvent) => {
    if (event.readAt) return;
    setLoading(event.id);
    markRead(event.taskId);
    try {
      await markTaskRead(event.taskId);
    } catch (err) {
      console.error('[NotificationsPage] markTaskRead failed:', err);
    } finally {
      setLoading(null);
    }
    if (event.taskType === 'document_vectorize' && libraryEnabled) {
      router.push('/library');
    }
  };

  const unreadCount = events.filter((e) => !e.readAt).length;

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--background)' }}>
      <div
        className="flex-shrink-0 h-12 px-4 flex items-center gap-2 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <SidebarTrigger className="-ml-1" />
        <span className="ml-1 text-sm font-medium" style={{ color: 'var(--foreground)' }}>{t('center')}</span>
        {unreadCount > 0 && (
          <span
            className="ml-2 text-xs px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: 'var(--danger)', color: 'var(--danger-foreground)' }}
          >
            {unreadCount}
          </span>
        )}
      </div>

      <div className="px-8 pt-4 flex gap-4 border-b" style={{ borderColor: 'var(--border)' }}>
        {(['all', 'unread'] as Tab[]).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className="pb-3 text-sm font-medium border-b-2 transition-colors cursor-pointer"
            style={{
              color: tab === tabKey ? 'var(--foreground)' : 'var(--muted)',
              borderColor: tab === tabKey ? 'var(--brand)' : 'transparent',
            }}
          >
            {tabKey === 'all' ? t('tabAll') : t('tabUnread')}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-4">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              {tab === 'unread' ? t('noUnreadNotifications') : t('noNotifications')}
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-w-2xl">
            {filtered.map((event) => (
              <button
                key={event.id}
                onClick={() => handleItemClick(event)}
                disabled={loading === event.id}
                className="w-full text-left p-4 rounded-xl transition-opacity cursor-pointer disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  opacity: event.readAt ? 0.6 : 1,
                }}
              >
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--muted)' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                        {event.message || t('taskNotification')}
                      </p>
                      {event.status !== 'processing' && (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: STATUS_COLOR[event.status], color: event.status === 'done' ? 'var(--success-foreground)' : event.status === 'error' ? 'var(--danger-foreground)' : 'var(--accent-foreground)' }}
                        >
                          {STATUS_LABEL_KEYS[event.status] ? t(STATUS_LABEL_KEYS[event.status]) : event.status}
                        </span>
                      )}
                      {loading === event.id && <Loader2 className="w-3 h-3 animate-spin" style={{ color: 'var(--muted)' }} />}
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                      {relativeTime(event.createdAt)}
                      {event.readAt && <span className="ml-2">· {t('read')}</span>}
                    </p>
                  </div>
                  {!event.readAt && (
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0 mt-2"
                      style={{ backgroundColor: 'var(--brand)' }}
                    />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
