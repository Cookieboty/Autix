'use client';

import { Bell } from 'lucide-react';
import { Button, Badge } from '@heroui/react';
import { useTaskStore } from '@/store/task.store';
import { useUiStore } from '@/store/ui.store';

export function NotificationBell() {
  const events = useTaskStore((s) => s.events);
  const unreadCount = events.filter((e) => !e.readAt).length;
  const openNotificationDrawer = useUiStore((s) => s.openNotificationDrawer);

  const button = (
    <Button
      isIconOnly
      variant="ghost"
      size="sm"
      className="cursor-pointer min-w-7 h-7"
      onPress={openNotificationDrawer}
      aria-label="通知中心"
    >
      <Bell className="w-3.5 h-3.5" style={{ color: 'var(--muted)' }} />
    </Button>
  );

  return unreadCount > 0 ? (
    <Badge
      content={unreadCount > 99 ? '99+' : String(unreadCount)}
      color="danger"
      variant="solid"
      size="sm"
      placement="top-right"
    >
      {button}
    </Badge>
  ) : button;
}
