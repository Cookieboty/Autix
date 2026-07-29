'use client';

import { useRouter } from '@/i18n/navigation';
import {
  AdminSystemDashboardView,
  ChatAdminDashboardView,
  ProfileSyncBlockedState,
  UnsupportedSystemState,
} from '@autix/shared-ui/admin';
import { RouteLoader } from '@autix/shared-ui/ui';
import {
  selectCurrentSystemCode,
  useAuthStore,
} from '@autix/shared-store';

export default function DashboardPage() {
  const router = useRouter();
  const hydrated = useAuthStore((state) => state.hydrated);
  const systemCode = useAuthStore(selectCurrentSystemCode);
  const profileSyncStatus = useAuthStore((state) => state.profileSyncStatus);
  const onNavigate = (path: string) => router.push(path);

  if (!hydrated) return <RouteLoader />;
  if (profileSyncStatus !== 'ready') {
    return <ProfileSyncBlockedState status={profileSyncStatus} />;
  }
  if (systemCode === 'chat') {
    return <ChatAdminDashboardView onNavigate={onNavigate} />;
  }
  if (systemCode === 'admin-system') {
    return <AdminSystemDashboardView onNavigate={onNavigate} />;
  }
  return <UnsupportedSystemState systemCode={systemCode} />;
}
