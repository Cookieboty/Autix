'use client';

import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { MembershipOrdersView } from '@autix/shared-ui';

export default function OrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const checkout = searchParams.get('checkout');
  const sessionId = searchParams.get('session_id');

  return (
    <MembershipOrdersView
      showSidebarTrigger
      checkoutStatus={checkout}
      checkoutSessionId={sessionId}
      onNavigateCheckoutResult={({ checkout: status, sessionId: id }) => {
        const params = new URLSearchParams();
        if (status) params.set('checkout', status);
        if (id) params.set('session_id', id);
        router.replace(`/membership/orders/checkout?${params.toString()}`);
      }}
      onNavigateOrder={(orderId) => router.push(`/membership/orders/${orderId}`)}
    />
  );
}
