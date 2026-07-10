'use client';

import { useParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { MembershipOrderDetailView } from '@autix/shared-ui';

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  return (
    <MembershipOrderDetailView
      showSidebarTrigger
      orderId={params.id}
      onBack={() => router.push('/membership/orders')}
    />
  );
}
