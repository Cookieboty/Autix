'use client';

import { useRouter } from '@/i18n/navigation';
import { AdminMembershipUsersView } from '@autix/shared-ui/admin';

export default function AdminUsersPage() {
  const router = useRouter();
  return <AdminMembershipUsersView onOpenUserDetail={(userId) => router.push(`/admin/membership/users/${userId}`)} />;
}
