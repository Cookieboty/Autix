'use client';

import { Bell } from 'lucide-react';
import { useTaskStore } from '@/store/task.store';
import { useUiStore } from '@/store/ui.store';

export function NotificationBell() {
  const events = useTaskStore((s) => s.events);
  const unreadCount = events.filter((e) => !e.readAt).length;
  const openNotificationDrawer = useUiStore((s) => s.openNotificationDrawer);

  return (
    <button
      onClick={openNotificationDrawer}
      className="relative p-1.5 rounded-lg transition-colors cursor-pointer"
      style={{ color: 'var(--muted)' }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--foreground)')}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--muted)')}
      title="通知中心"
    >
      <Bell className="w-3.5 h-3.5" />
      {unreadCount > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-0.5 rounded-full text-[9px] font-bold flex items-center justify-center"
          style={{ backgroundColor: 'var(--danger)', color: 'var(--danger-foreground)' }}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}
