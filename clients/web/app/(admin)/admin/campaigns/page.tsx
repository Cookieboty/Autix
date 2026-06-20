'use client';

import { useRouter } from 'next/navigation';
import { AdminCampaignsView } from '@autix/shared-ui/admin';

export default function AdminCampaignsPage() {
  const router = useRouter();

  return <AdminCampaignsView onBack={() => router.push('/admin')} />;
}
