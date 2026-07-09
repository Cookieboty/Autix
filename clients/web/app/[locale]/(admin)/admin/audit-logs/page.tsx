'use client';

import { useRouter } from 'next/navigation';
import { AdminAuditLogsView } from '@autix/shared-ui/admin';

export default function AdminAuditLogsPage() {
  const router = useRouter();

  return <AdminAuditLogsView onBack={() => router.push('/admin')} />;
}
