'use client';

import { useRouter } from '@/i18n/navigation';
import { AdminDashboardView } from '@autix/shared-ui/admin';

export default function DashboardPage() {
  const router = useRouter();
  return <AdminDashboardView onNavigate={(path) => router.push(path)} />;
}
