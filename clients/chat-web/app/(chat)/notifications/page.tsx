'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Loader2 } from 'lucide-react';
import { useTaskStore, TaskEvent } from '@/store/task.store';
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

export default function NotificationsPage() {
  const router = useRouter();
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
    if (event.taskType === 'document_vectorize') {
      router.push('/library');
    }
  };

  const unreadCount = events.filter((e) => !e.readAt).length;

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--background)' }}>
      <div
        className="flex-shrink-0 h-14 px-8 flex items-center border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>通知中心</span>
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
        {(['all', 'unread'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="pb-3 text-sm font-medium border-b-2 transition-colors cursor-pointer"
            style={{
              color: tab === t ? 'var(--foreground)' : 'var(--muted)',
              borderColor: tab === t ? 'var(--accent)' : 'transparent',
            }}
          >
            {t === 'all' ? '全部' : '未读'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-4">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              {tab === 'unread' ? '暂无未读通知' : '暂无通知'}
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
                        {event.message || '任务通知'}
                      </p>
                      {event.status !== 'processing' && (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: STATUS_COLOR[event.status], color: event.status === 'done' ? 'var(--success-foreground)' : event.status === 'error' ? 'var(--danger-foreground)' : 'var(--accent-foreground)' }}
                        >
                          {STATUS_LABEL[event.status]}
                        </span>
                      )}
                      {loading === event.id && <Loader2 className="w-3 h-3 animate-spin" style={{ color: 'var(--muted)' }} />}
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                      {relativeTime(event.createdAt)}
                      {event.readAt && <span className="ml-2">· 已读</span>}
                    </p>
                  </div>
                  {!event.readAt && (
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0 mt-2"
                      style={{ backgroundColor: 'var(--accent)' }}
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