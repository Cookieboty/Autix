'use client';

import { Bell } from 'lucide-react';
import { useTaskStore } from '@/store/task.store';
import { useState, useRef, useEffect } from 'react';
import { NotificationPanel } from './NotificationPanel';

export function NotificationBell() {
  const events = useTaskStore((s) => s.events);
  const unreadCount = events.filter((e) => !e.readAt).length;
  const [open, setOpen] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={bellRef}
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg transition-colors cursor-pointer"
        style={{ color: 'var(--muted)' }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--foreground)')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--muted)')}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
            style={{ backgroundColor: 'var(--danger)', color: 'white' }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {open && <NotificationPanel onClose={() => setOpen(false)} />}
    </div>
  );
}
