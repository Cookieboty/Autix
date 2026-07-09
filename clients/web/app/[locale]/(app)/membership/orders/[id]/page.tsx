'use client';

import { useParams, useRouter } from 'next/navigation';
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
