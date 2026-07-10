'use client';

import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { MembershipOrderDetailView } from '@autix/shared-ui';

export default function CheckoutResultPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id') ?? undefined;
  const checkout = searchParams.get('checkout');

  return (
    <MembershipOrderDetailView
      showSidebarTrigger
      checkoutSessionId={sessionId}
      checkoutStatus={checkout}
      onBack={() => router.push('/membership/orders')}
    />
  );
}
