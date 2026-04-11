'use client';

import { useRouter } from 'next/navigation';
import { FileText, Check } from 'lucide-react';
import { useTaskStore } from '@/store/task.store';
import { markTaskRead } from '@/lib/api';
import { relativeTime } from '@/lib/utils';

interface Props {
  onClose: () => void;
}

export function NotificationPanel({ onClose }: Props) {
  const router = useRouter();
  const events = useTaskStore((s) => s.events);
  const markRead = useTaskStore((s) => s.markRead);
  const unreadEvents = events.filter((e) => !e.readAt).slice(0, 20);

  const handleItemClick = async (event: typeof events[0]) => {
    markRead(event.taskId);
    try {
      await markTaskRead(event.taskId);
    } catch (err) {
      console.error('[NotificationPanel] markTaskRead failed:', err);
    }
    if (event.taskType === 'document_vectorize') {
      router.push('/library');
    }
    onClose();
  };

  return (
    <div
      className="absolute left-full top-0 ml-2 w-80 rounded-xl shadow-xl z-50 overflow-hidden"
      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div
        className="px-4 py-3 border-b flex items-center justify-between"
        style={{ borderColor: 'var(--border)' }}
      >
        <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>通知</span>
        <a
          href="/notifications"
          className="text-xs hover:underline cursor-pointer"
          style={{ color: 'var(--accent)' }}
          onClick={onClose}
        >
          查看全部
        </a>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {unreadEvents.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs" style={{ color: 'var(--muted)' }}>暂无新通知</p>
          </div>
        ) : (
          unreadEvents.map((event) => (
            <button
              key={event.id}
              onClick={() => handleItemClick(event)}
              className="w-full px-4 py-3 text-left hover:opacity-80 transition-opacity cursor-pointer"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div className="flex items-start gap-2">
                <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--muted)' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate" style={{ color: 'var(--foreground)' }}>
                    {event.message || '任务通知'}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    {relativeTime(event.createdAt)}
                  </p>
                </div>
                {event.status === 'done' && (
                  <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#22c55e' }} />
                )}
                {event.status === 'error' && (
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--danger)', color: 'white' }}>
                    失败
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
