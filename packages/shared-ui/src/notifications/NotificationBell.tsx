'use client';

import { Bell } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useTranslations } from 'next-intl';
import { useTaskStore } from '@autix/shared-store';
import { useUiStore } from '@autix/shared-store';

export function NotificationBell() {
  const t = useTranslations('notification');
  const events = useTaskStore((s) => s.events);
  const unreadCount = events.filter((e) => !e.readAt).length;
  const openNotificationDrawer = useUiStore((s) => s.openNotificationDrawer);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="cursor-pointer min-w-7 h-7 p-0"
        onClick={openNotificationDrawer}
        aria-label={t('center')}
      >
        <Bell className="w-3.5 h-3.5 text-muted-foreground" />
      </Button>
      {unreadCount > 0 && (
        <Badge
          variant="destructive"
          className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center"
        >
          {unreadCount > 99 ? '99+' : String(unreadCount)}
        </Badge>
      )}
    </div>
  );
}
