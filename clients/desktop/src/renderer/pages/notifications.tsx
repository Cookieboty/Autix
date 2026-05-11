import { NotificationDrawer, SidebarTrigger } from '@autix/shared-ui';

export function NotificationsPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        <SidebarTrigger className="-ml-1" />
        <h1 className="ml-1 text-sm font-semibold text-foreground">通知中心</h1>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <NotificationDrawer />
      </div>
    </div>
  );
}
