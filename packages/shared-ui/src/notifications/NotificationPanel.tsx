'use client';

import { useState } from 'react';
import { useRouter } from '../navigation';
import { FileText, Check, Bell } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useLibraryEnabled } from '../hooks/useModelConfigEnabled';
import { useTaskStore, TaskEvent } from '@autix/shared-store';
import { useUiStore } from '@autix/shared-store';
import { relativeTime } from '../format';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';

type Tab = 'all' | 'unread';

const STATUS_BG_CLASS: Record<string, string> = {
  processing: 'bg-primary text-primary-foreground',
  done: 'bg-success text-success-foreground',
  error: 'bg-destructive text-destructive-foreground',
};

const STATUS_LABEL_KEYS: Record<string, string> = {
  processing: 'statusProcessing',
  done: 'statusDone',
  error: 'statusError',
};

export function NotificationDrawer() {
  const t = useTranslations('notification');
  const locale = useLocale();
  const router = useRouter();
  const libraryEnabled = useLibraryEnabled(false);
  const events = useTaskStore((s) => s.events);
  const markReadRemote = useTaskStore((s) => s.markReadRemote);
  const { notificationDrawerOpen, closeNotificationDrawer } = useUiStore();
  const [tab, setTab] = useState<Tab>('all');

  const unreadCount = events.filter((e) => !e.readAt).length;
  const filtered = tab === 'unread' ? events.filter((e) => !e.readAt) : events;

  const handleItemClick = async (event: TaskEvent) => {
    if (event.readAt) return;
    try {
      await markReadRemote(event.taskId);
    } catch (err) {
      console.error('[NotificationDrawer] markTaskRead failed:', err);
    }
    if (event.taskType === 'document_vectorize' && libraryEnabled) {
      closeNotificationDrawer();
      router.push('/library');
    }
  };

  const handleViewAll = () => {
    closeNotificationDrawer();
    router.push('/notifications');
  };

  return (
    <Sheet
      open={notificationDrawerOpen}
      onOpenChange={(open) => {
        if (!open) closeNotificationDrawer();
      }}
    >
      <SheetContent
        side="right"
        className="w-[380px] sm:max-w-[380px] p-0 gap-0"
      >
        <SheetHeader className="shrink-0 flex-row items-center justify-between gap-2 border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-foreground" />
            <SheetTitle className="text-sm font-semibold">
              {t('center')}
            </SheetTitle>
            {unreadCount > 0 && (
              <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-medium text-destructive-foreground">
                {unreadCount}
              </span>
            )}
          </div>
          <SheetDescription className="sr-only">
            {t('center')}
          </SheetDescription>
        </SheetHeader>

        <div className="flex shrink-0 gap-4 border-b border-border px-5">
          {(['all', 'unread'] as Tab[]).map((tabKey) => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={`cursor-pointer border-b-2 py-3 text-sm font-medium transition-colors ${
                tab === tabKey
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground'
              }`}
            >
              {tabKey === 'all'
                ? t('tabAll')
                : unreadCount > 0
                  ? t('tabUnreadWithCount', { count: unreadCount })
                  : t('tabUnread')}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center pb-16">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-card">
                <Bell className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {tab === 'unread'
                  ? t('noUnreadNotifications')
                  : t('noNotifications')}
              </p>
            </div>
          ) : (
            <div className="py-2">
              {filtered.map((event) => (
                <button
                  key={event.id}
                  onClick={() => handleItemClick(event)}
                  disabled={!!event.readAt}
                  className={`w-full cursor-pointer border-b border-border px-5 py-3.5 text-left transition-colors disabled:cursor-default ${
                    event.readAt ? 'opacity-55' : 'hover:bg-card'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">
                          {event.message || t('taskNotification')}
                        </p>
                        {event.status !== 'processing' && (
                          <span
                            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
                              STATUS_BG_CLASS[event.status] ?? ''
                            }`}
                          >
                            {STATUS_LABEL_KEYS[event.status]
                              ? t(STATUS_LABEL_KEYS[event.status])
                              : event.status}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {relativeTime(event.createdAt, locale)}
                        {event.readAt && (
                          <span className="ml-2">· {t('read')}</span>
                        )}
                      </p>
                    </div>
                    <div className="mt-1 flex shrink-0 items-center">
                      {!event.readAt && (
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      )}
                      {event.status === 'done' && event.readAt && (
                        <Check className="h-3.5 w-3.5 text-success" />
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-border px-5 py-3">
          <button
            onClick={handleViewAll}
            className="w-full cursor-pointer rounded-lg py-2 text-center text-xs text-primary transition-colors hover:bg-card"
          >
            {t('viewAllHistory')}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
