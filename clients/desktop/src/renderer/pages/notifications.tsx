import { NotificationDrawer } from '@autix/shared-ui';

export function NotificationsPage() {
  return (
    <div style={{ flex: 1, padding: 24, overflow: 'auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>通知中心</h1>
      <NotificationDrawer />
    </div>
  );
}
