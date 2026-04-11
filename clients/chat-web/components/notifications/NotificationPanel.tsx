'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Check, X, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTaskStore, TaskEvent } from '@/store/task.store';
import { useUiStore } from '@/store/ui.store';
import { markTaskRead } from '@/lib/api';
import { relativeTime } from '@/lib/utils';

type Tab = 'all' | 'unread';

const STATUS_COLOR: Record<string, string> = {
  processing: 'var(--accent)',
  done: 'var(--success)',
  error: 'var(--danger)',
};

const STATUS_LABEL: Record<string, string> = {
  processing: '处理中',
  done: '已完成',
  error: '失败',
};

export function NotificationDrawer() {
  const router = useRouter();
  const events = useTaskStore((s) => s.events);
  const markRead = useTaskStore((s) => s.markRead);
  const { notificationDrawerOpen, closeNotificationDrawer } = useUiStore();
  const [tab, setTab] = useState<Tab>('all');

  const unreadCount = events.filter((e) => !e.readAt).length;
  const filtered = tab === 'unread' ? events.filter((e) => !e.readAt) : events;

  const handleItemClick = async (event: TaskEvent) => {
    if (event.readAt) return;
    markRead(event.taskId);
    try {
      await markTaskRead(event.taskId);
    } catch (err) {
      console.error('[NotificationDrawer] markTaskRead failed:', err);
    }
    if (event.taskType === 'document_vectorize') {
      closeNotificationDrawer();
      router.push('/library');
    }
  };

  const handleViewAll = () => {
    closeNotificationDrawer();
    router.push('/notifications');
  };

  return (
    <AnimatePresence>
      {notificationDrawerOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40"
            style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
            onClick={closeNotificationDrawer}
          />

          {/* Drawer */}
          <motion.div
            key="drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed right-0 top-0 h-full w-[380px] z-50 flex flex-col"
            style={{
              backgroundColor: 'var(--background)',
              borderLeft: '1px solid var(--border)',
              boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
            }}
          >
            {/* Header */}
            <div
              className="flex-shrink-0 flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4" style={{ color: 'var(--foreground)' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  通知中心
                </span>
                {unreadCount > 0 && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                    style={{
                      backgroundColor: 'var(--danger)',
                      color: 'var(--danger-foreground)',
                    }}
                  >
                    {unreadCount}
                  </span>
                )}
              </div>
              <button
                onClick={closeNotificationDrawer}
                className="p-1.5 rounded-lg transition-colors cursor-pointer"
                style={{ color: 'var(--muted)' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--foreground)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--muted)')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div
              className="flex-shrink-0 flex px-5 gap-4"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              {(['all', 'unread'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className="py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer"
                  style={{
                    color: tab === t ? 'var(--foreground)' : 'var(--muted)',
                    borderColor: tab === t ? 'var(--accent)' : 'transparent',
                  }}
                >
                  {t === 'all' ? '全部' : `未读${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full pb-16">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                    style={{ backgroundColor: 'var(--surface)' }}
                  >
                    <Bell className="w-5 h-5" style={{ color: 'var(--muted)' }} />
                  </div>
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>
                    {tab === 'unread' ? '暂无未读通知' : '暂无通知'}
                  </p>
                </div>
              ) : (
                <div className="py-2">
                  {filtered.map((event) => (
                    <button
                      key={event.id}
                      onClick={() => handleItemClick(event)}
                      disabled={!!event.readAt}
                      className="w-full px-5 py-3.5 text-left transition-colors cursor-pointer disabled:cursor-default"
                      style={{
                        borderBottom: '1px solid var(--border)',
                        opacity: event.readAt ? 0.55 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (!event.readAt)
                          (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: 'var(--surface)' }}
                        >
                          <FileText className="w-4 h-4" style={{ color: 'var(--muted)' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
                              {event.message || '任务通知'}
                            </p>
                            {event.status !== 'processing' && (
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
                                style={{
                                  backgroundColor: STATUS_COLOR[event.status],
                                  color:
                                    event.status === 'done'
                                      ? 'var(--success-foreground)'
                                      : 'var(--danger-foreground)',
                                }}
                              >
                                {STATUS_LABEL[event.status]}
                              </span>
                            )}
                          </div>
                          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                            {relativeTime(event.createdAt)}
                            {event.readAt && <span className="ml-2">· 已读</span>}
                          </p>
                        </div>
                        <div className="flex-shrink-0 flex items-center mt-1">
                          {!event.readAt && (
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: 'var(--accent)' }}
                            />
                          )}
                          {event.status === 'done' && event.readAt && (
                            <Check className="w-3.5 h-3.5" style={{ color: 'var(--success)' }} />
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              className="flex-shrink-0 px-5 py-3"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <button
                onClick={handleViewAll}
                className="w-full text-xs text-center py-2 rounded-lg transition-colors cursor-pointer"
                style={{ color: 'var(--accent)' }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface)')
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')
                }
              >
                查看全部通知历史
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
