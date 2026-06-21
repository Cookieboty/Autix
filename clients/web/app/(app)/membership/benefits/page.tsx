'use client';

import { useRouter } from 'next/navigation';
import { MembershipBenefitsView } from '@autix/shared-ui';

export default function MembershipBenefitsPage() {
  const router = useRouter();

  return (
    <MembershipBenefitsView
      showSidebarTrigger
      onNavigateOrder={(orderId) => router.push(`/membership/orders/${orderId}`)}
      onCheckoutFallback={() => router.push('/membership/orders')}
    />
  );
}
