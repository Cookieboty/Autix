'use client';

import { useParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { AdminMembershipUserDetailView } from '@autix/shared-ui/admin';

export default function AdminUserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;
  return <AdminMembershipUserDetailView userId={userId} onBack={() => router.push('/admin/membership/users')} />;
}
